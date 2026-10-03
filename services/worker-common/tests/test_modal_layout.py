"""Offline Modal SDK registration, without credentials, deployment or remote calls."""

import importlib.util
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from showcrafter_workers.__main__ import fake_handler

PATH = Path(__file__).resolve().parents[2] / "workers/modal_app.py"
SPEC = importlib.util.spec_from_file_location("worker_modal_app", PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ModalLayoutTests(unittest.TestCase):
    def test_sdk_registers_functions_without_network(self):
        app = MODULE.create_worker_app("test-worker", {"diagnostic": fake_handler})
        self.assertIsInstance(app, MODULE.modal.App)
        self.assertEqual(app.name, "test-worker")

    def test_empty_registry_fails_closed(self):
        with self.assertRaises(ValueError):
            MODULE.create_worker_app("test-worker", {})

    def test_wake_uses_proxy_auth_and_spawn(self):
        app = Mock()
        functions = {}

        def register(**options):
            def decorate(function):
                function.spawn = Mock(return_value=Mock(object_id="fc-diagnostic"))
                functions[options["name"]] = function
                return function

            return decorate

        app.function.side_effect = register
        registered = []

        def endpoint(**kwargs):
            registered.append(kwargs)
            return lambda function: function

        with (
            patch.object(MODULE.modal, "App", return_value=app),
            patch.object(MODULE.modal, "fastapi_endpoint", side_effect=endpoint),
        ):
            MODULE.create_worker_app("test-worker", {"diagnostic": fake_handler})
        self.assertEqual(functions["wake"](), {"call_id": "fc-diagnostic"})
        functions["drain_jobs"].spawn.assert_called_once_with()
        self.assertEqual(set(functions), {"drain_jobs", "wake"})
        options = [call.kwargs for call in app.function.call_args_list]
        self.assertTrue(registered[0]["requires_proxy_auth"])
        self.assertEqual(registered[0]["method"], "POST")
        for option in options:
            self.assertEqual(option["min_containers"], 0)
            self.assertEqual(option["buffer_containers"], 0)
            if option["name"] == "drain_jobs":
                self.assertEqual(option["retries"], 0)
            self.assertNotIn("schedule", option)
