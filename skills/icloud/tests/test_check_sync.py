import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "check_sync", Path(__file__).resolve().parents[1] / "scripts/check-sync.py")
check = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check)


def metadata(**overrides):
    return "\n".join(f"{key} = {overrides.get(key, value)};"
                     for key, value in check.EXPECTED.items())


class StatusTests(unittest.TestCase):
    def test_ok(self):
        self.assertEqual(check.parse_status(metadata())[0], 0)

    def test_every_mismatch(self):
        for key, expected in check.EXPECTED.items():
            with self.subTest(key=key):
                self.assertEqual(check.parse_status(metadata(**{key: str(1-int(expected))}))[0], 1)

    def test_missing_duplicate_and_invalid(self):
        for output in ("", metadata() + "\nisUploaded = 1;",
                       metadata(isUploaded="unknown"),
                       metadata().replace("isUploaded = 1;", "")):
            self.assertEqual(check.parse_status(output)[0], 2)

    def test_inspect(self):
        result = subprocess.CompletedProcess([], 0, metadata(), "")
        with patch.object(check.subprocess, "run", return_value=result) as run:
            self.assertEqual(check.inspect(Path("test"))[0], 0)
            self.assertEqual(run.call_args.args[0], ["fileproviderctl", "evaluate", "test"])
        result.returncode = 1
        with patch.object(check.subprocess, "run", return_value=result):
            self.assertEqual(check.inspect(Path("test"))[0], 2)
        for error in (OSError(), UnicodeError(), subprocess.TimeoutExpired("test", 15)):
            with patch.object(check.subprocess, "run", side_effect=error):
                self.assertEqual(check.inspect(Path("test"))[0], 2)


class PathTests(unittest.TestCase):
    def setUp(self):
        self.base = Path(tempfile.mkdtemp(prefix="icloud-check-test-")).resolve()
        # Follow this machine's deletion policy, including synthetic fixtures.
        self.addCleanup(subprocess.run, ["/usr/bin/trash", str(self.base)], check=True)
        self.cloud = self.base / "cloud"
        self.cloud.mkdir()
        self.root = self.cloud / "archive"
        self.root.mkdir()
        self.file = self.root / "doc.md"
        self.file.write_text("synthetic", encoding="utf-8")

    def test_regular_and_hidden(self):
        hidden = self.root / ".hidden"
        hidden.mkdir()
        doc = hidden / ".doc"
        doc.write_text("synthetic")
        files, errors = check.collect([self.root], self.cloud, self.root)
        self.assertEqual(files, {self.file, doc})
        self.assertEqual(errors, [])

    def test_root_argument_symlink_allowed(self):
        link = self.base / "link"
        link.symlink_to(self.root, target_is_directory=True)
        root = check.resolve_target(link, self.cloud)
        self.assertEqual(check.collect([link], self.cloud, root), ({self.file}, []))

    def test_nested_symlinks_not_followed(self):
        link = self.root / "nested"
        link.symlink_to(self.root, target_is_directory=True)
        files, errors = check.collect([self.root], self.cloud, self.root)
        self.assertEqual(files, {self.file})
        self.assertTrue(errors)

    def test_explicit_outside_and_other_archive_rejected(self):
        outside = self.base / "outside.md"
        outside.write_text("synthetic")
        other = self.cloud / "other.md"
        other.write_text("synthetic")
        for path in (outside, other, self.root / "missing"):
            files, errors = check.collect([path], self.cloud, self.root)
            self.assertFalse(files)
            self.assertTrue(errors)

    def test_broken_symlink(self):
        link = self.root / "broken"
        link.symlink_to(self.root / "missing")
        self.assertTrue(check.collect([link], self.cloud, self.root)[1])

    def test_empty_folder_and_empty_selection(self):
        empty = self.root / "empty"
        empty.mkdir()
        self.assertTrue(check.collect([empty], self.cloud, self.root)[1])
        self.assertTrue(check.collect([], self.cloud, self.root)[1])

    def test_empty_subfolder_does_not_block_nonempty_selection(self):
        empty = self.root / "empty"
        empty.mkdir()
        self.assertEqual(check.collect([self.root], self.cloud, self.root),
                         ({self.file}, []))
        self.assertTrue(check.collect([self.file, empty], self.cloud, self.root)[1])
        # Duplicate and overlapping arguments are valid, evaluated once.
        self.assertEqual(check.collect([self.root, self.file], self.cloud, self.root),
                         ({self.file}, []))

    def test_relative_argument_uses_cwd(self):
        previous = Path.cwd()
        try:
            os.chdir(self.root)
            self.assertEqual(check.collect([Path("doc.md")], self.cloud, self.root),
                             ({self.file}, []))
        finally:
            os.chdir(previous)

    def test_missing_tool(self):
        with patch.object(check.shutil, "which", return_value=None), \
             contextlib.redirect_stderr(io.StringIO()), \
             self.assertRaises(SystemExit) as error:
            check.main([str(self.file)])
        self.assertEqual(error.exception.code, 2)

    def test_scandir_failure(self):
        with patch.object(check.os, "scandir", side_effect=PermissionError()):
            files, errors = check.collect([self.root], self.cloud, self.root)
        self.assertFalse(files)
        self.assertTrue(errors)

    def test_special_file(self):
        fifo = self.root / "pipe"
        os.mkfifo(fifo)
        self.assertTrue(check.collect([fifo], self.cloud, self.root)[1])

    def test_cli_exit_codes_and_root(self):
        with patch.object(check, "CLOUD", self.cloud), \
             patch.object(check.shutil, "which", return_value="fileproviderctl"), \
             contextlib.redirect_stdout(io.StringIO()), \
             contextlib.redirect_stderr(io.StringIO()):
            for code in (0, 1, 2):
                with patch.object(check, "inspect", return_value=(code, "synthetic")):
                    self.assertEqual(check.main(["--root", str(self.root), str(self.file)]), code)
            with patch.object(check, "inspect", return_value=(1, "synthetic")):
                self.assertEqual(check.main([str(self.file), str(self.root / "missing")]), 2)
            with self.assertRaises(SystemExit) as error:
                check.main([])
            self.assertEqual(error.exception.code, 2)
            with self.assertRaises(SystemExit) as error:
                check.main(["--root", str(self.file), str(self.file)])
            self.assertEqual(error.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
