"""No GUI effects: test command execution and restoration with mocked IPC."""
import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "with_focus", Path(__file__).with_name("with-focus.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FocusTests(unittest.TestCase):
    def run_case(self, window, command_status=0, restore_error=None):
        responses = [{"ok": True, "result": {"payload": {"window": window}}}]
        responses.append(restore_error or {"ok": True})
        with patch.object(module.Path, "is_file", return_value=True), \
             patch.object(module.os, "access", return_value=True), \
             patch.object(module, "request", side_effect=responses) as request, \
             patch.object(module.subprocess, "run", return_value=subprocess.CompletedProcess([], command_status)) as run:
            result = module.main(["--", "example-command", "arg with spaces"])
            return result, request.call_args_list, run.call_args_list

    def test_focus_accepts_empty_success_output(self):
        with patch.object(module.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout="")):
            self.assertEqual(module.request("ctl", "window", "focus", "id"), {"ok": True})

    def test_focus_accepts_text_acknowledgement(self):
        with patch.object(module.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout="executed\n")):
            self.assertEqual(module.request("ctl", "window", "focus", "id"), {"ok": True})

    def test_query_rejects_empty_output(self):
        with patch.object(module.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout="")):
            with self.assertRaises(ValueError):
                module.request("ctl", "query", "focused-window")

    def test_success_restores(self):
        result, requests, commands = self.run_case({"id": "fresh-id"})
        self.assertEqual(result, 0)
        self.assertEqual(requests[-1].args[1:], ("window", "focus", "fresh-id"))
        self.assertEqual(commands[0].args[0], ["example-command", "arg with spaces"])

    def test_command_failure_still_restores(self):
        result, requests, _ = self.run_case({"id": "fresh-id"}, 7)
        self.assertEqual(result, 7)
        self.assertEqual(len(requests), 2)

    def test_no_focused_window_refuses_command(self):
        result, requests, commands = self.run_case(None)
        self.assertEqual(result, 2)
        self.assertEqual(len(requests), 1)
        self.assertEqual(commands, [])

    def test_restore_failure_is_not_success(self):
        result, _, _ = self.run_case({"id": "fresh-id"}, restore_error=RuntimeError("gone"))
        self.assertEqual(result, 1)


if __name__ == "__main__":
    unittest.main()
