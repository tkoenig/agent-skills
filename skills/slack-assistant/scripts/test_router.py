import json
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch

script = runpy.run_path(str(Path(__file__).with_name('slack-assistant')))
organization, main = script['organization'], script['main']


class RouterTest(unittest.TestCase):
    def test_directory_boundaries(self):
        home = Path('/example/home')
        for name in ('wearedevs', 'wollzelle'):
            for suffix in ('', '/project/nested'):
                self.assertEqual(name, organization(home / f'Development/{name}{suffix}', home))
        with self.assertRaises(ValueError):
            organization(home / 'Development/wearedevs-other', home)
        self.assertEqual('wollzelle', organization(Path('/outside'), home, 'wollzelle'))
        with self.assertRaises(ValueError):
            organization(Path('/outside'), home)
        with self.assertRaises(ValueError):
            organization(Path('/outside'), home, 'unknown')

    def run_command(self, args, team='T1'):
        routes = {'wearedevs': {'profile': 'T1', 'team_id': 'T1'}}
        profiles = {'workspaces': {'T1': {'workspace_id': team, 'workspace_name': 'Example'}}}
        def read(path):
            return json.dumps(routes if path.name == 'directory-workspaces.json' else profiles)
        with patch.object(Path, 'home', return_value=Path('/example/home')), \
             patch.object(Path, 'cwd', return_value=Path('/example/home/Development/wearedevs/app')), \
             patch.object(Path, 'exists', return_value=True), \
             patch.object(Path, 'read_text', read), \
             patch('os.execvp') as execute:
            main(args)
            return execute

    def test_draft_injects_exact_profile(self):
        execute = self.run_command(['draft', '--recipient-id=C1', '--message=Review'])
        execute.assert_called_once_with('slackcli', ['slackcli', 'messages', 'draft', '--recipient-id=C1', '--message=Review', '--workspace', 'T1'])

    def test_live_auth_check_uses_bound_workspace(self):
        execute = self.run_command(['team', 'info', '--json'])
        execute.assert_called_once_with('slackcli', ['slackcli', 'team', 'info', '--json', '--workspace', 'T1'])

    def test_approved_send_preserves_attachment_and_workspace(self):
        execute = self.run_command(['send-approved', '--recipient-id=C1', '--message=Approved', '--file=/screenshot.png'])
        execute.assert_called_once_with('slackcli', ['slackcli', 'messages', 'send', '--recipient-id=C1', '--message=Approved', '--file=/screenshot.png', '--workspace', 'T1'])

    def test_mutations_and_override_blocked(self):
        for args in (['messages', 'send'], ['messages', 'edit'], ['auth', 'logout'],
                     ['draft', '--workspace=T2'], ['draft', '--workspace', 'T2'],
                     ['send-approved', '--workspace=T2'],
                     ['team', 'info', '--team=T2'], ['team', 'info', '--team', 'T2']):
            with self.subTest(args=args), self.assertRaises(ValueError):
                self.run_command(args)

    def test_identity_mismatch_blocked(self):
        for command in ('draft', 'send-approved'):
            with self.subTest(command=command), self.assertRaises(ValueError):
                self.run_command([command, '--message=Review'], team='T2')


if __name__ == '__main__':
    unittest.main()
