"""Offline music Modal registration without credentials or deployment."""

import unittest
from pathlib import Path


class MusicModalTests(unittest.TestCase):
    def test_modal_registration_is_offline(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "music_modal_app", Path(__file__).resolve().parents[1] / "modal_app.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.app.name, "showcrafter-music")


if __name__ == "__main__":
    unittest.main()
