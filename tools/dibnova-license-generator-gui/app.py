#!/usr/bin/env python3
"""DibNova License Generator — DibNova Technologies internal use only."""

from __future__ import annotations

import os
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk


def app_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def generator_dir() -> str:
    bundled = os.path.join(app_dir(), "generator")
    if os.path.isfile(os.path.join(bundled, "generate-license.js")):
        return bundled
    return os.path.join(os.path.dirname(app_dir()), "dibnova-license-generator")


def private_key_path() -> str:
    env_key = os.environ.get("DNT_LICENSE_PRIVATE_KEY", "").strip()
    if env_key and os.path.isfile(env_key):
        return env_key

    base = app_dir()
    candidates = [
        os.path.join(base, "generator", "keys", "license-private.pem"),
        os.path.join(base, "keys", "license-private.pem"),
        os.path.join(base, "..", "..", "..", "dibnova-license-generator", "keys", "license-private.pem"),
        os.path.join(base, "..", "..", "dibnova-license-generator", "keys", "license-private.pem"),
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "dibnova-license-generator",
            "keys",
            "license-private.pem",
        ),
    ]
    for candidate in candidates:
        resolved = os.path.normpath(candidate)
        if os.path.isfile(resolved):
            return resolved
    raise FileNotFoundError("Missing private signing key (license-private.pem).")


def node_exe() -> str:
    local = os.path.join(app_dir(), "runtime", "node", "node.exe")
    if os.path.isfile(local):
        return local
    portable = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "nodejs-portable",
        "node-v22.23.2-win-x64",
        "node.exe",
    )
    if os.path.isfile(portable):
        return portable
    return "node"


def parse_license_output(stdout: str) -> str:
    lines = stdout.splitlines()
    marker = "--- License (paste into DNT Dental activation) ---"
    for index, line in enumerate(lines):
        if marker in line:
            for follow in lines[index + 1 :]:
                stripped = follow.strip()
                if stripped:
                    return stripped
            break
    for line in reversed(lines):
        stripped = line.strip()
        if stripped and not stripped.startswith("License"):
            return stripped
    raise RuntimeError("Could not read license from generator output.")


def generate_license(clinic_id: str, clinic_name: str, installation_id: str) -> str:
    gen = generator_dir()
    script = os.path.join(gen, "generate-license.js")
    key = private_key_path()

    if not os.path.isfile(script):
        raise FileNotFoundError(f"Missing generator script:\n{script}")

    node = node_exe()
    args = [
        node,
        script,
        "--clinic-id",
        clinic_id,
        "--clinic-name",
        clinic_name,
        "--installation-id",
        installation_id,
    ]

    env = os.environ.copy()
    env["DNT_LICENSE_PRIVATE_KEY"] = key

    startupinfo = None
    creationflags = 0
    if sys.platform == "win32":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        creationflags = subprocess.CREATE_NO_WINDOW

    result = subprocess.run(
        args,
        capture_output=True,
        text=True,
        cwd=gen,
        env=env,
        startupinfo=startupinfo,
        creationflags=creationflags,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "License generation failed.").strip()
        raise RuntimeError(detail)

    return parse_license_output(result.stdout)


class LicenseGeneratorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("DibNova License Generator")
        self.geometry("720x520")
        self.minsize(640, 460)
        self.configure(padx=16, pady=16)

        header = ttk.Label(
            self,
            text="DibNova License Generator",
            font=("Segoe UI", 16, "bold"),
        )
        header.pack(anchor="w")

        subtitle = ttk.Label(
            self,
            text="DibNova Technologies — internal use only. Do not distribute.",
            foreground="#555555",
        )
        subtitle.pack(anchor="w", pady=(4, 16))

        form = ttk.Frame(self)
        form.pack(fill="x")
        form.columnconfigure(1, weight=1)

        self.clinic_name = tk.StringVar()
        self.clinic_id = tk.StringVar()
        self.installation_id = tk.StringVar()

        self._add_field(form, 0, "Clinic Name", self.clinic_name)
        self._add_field(form, 1, "Clinic ID", self.clinic_id)
        self._add_field(form, 2, "Installation ID", self.installation_id, required=True)

        actions = ttk.Frame(self)
        actions.pack(fill="x", pady=(12, 8))

        ttk.Button(actions, text="Generate License", command=self.on_generate).pack(side="left")
        ttk.Button(actions, text="Copy License", command=self.on_copy).pack(side="left", padx=(8, 0))

        ttk.Label(self, text="Generated License").pack(anchor="w")
        self.output = scrolledtext.ScrolledText(self, height=12, wrap="word", font=("Consolas", 10))
        self.output.pack(fill="both", expand=True, pady=(4, 0))

    def _add_field(
        self,
        parent: ttk.Frame,
        row: int,
        label: str,
        variable: tk.StringVar,
        required: bool = False,
    ) -> None:
        suffix = " *" if required else ""
        ttk.Label(parent, text=f"{label}{suffix}").grid(row=row, column=0, sticky="w", pady=6)
        entry = ttk.Entry(parent, textvariable=variable)
        entry.grid(row=row, column=1, sticky="ew", pady=6, padx=(12, 0))
        if row == 0:
            entry.focus_set()

    def on_generate(self) -> None:
        clinic_name = self.clinic_name.get().strip()
        clinic_id = self.clinic_id.get().strip()
        installation_id = self.installation_id.get().strip()

        if not clinic_name:
            messagebox.showerror("DibNova License Generator", "Clinic Name is required.")
            return
        if not clinic_id:
            messagebox.showerror("DibNova License Generator", "Clinic ID is required.")
            return
        if not installation_id:
            messagebox.showerror(
                "DibNova License Generator",
                "Installation ID is required.\nCopy it from the DNT Dental activation screen.",
            )
            return

        try:
            license_text = generate_license(clinic_id, clinic_name, installation_id)
        except Exception as exc:  # noqa: BLE001 - show friendly GUI error
            messagebox.showerror("DibNova License Generator", str(exc))
            return

        self.output.delete("1.0", tk.END)
        self.output.insert("1.0", license_text)

    def on_copy(self) -> None:
        license_text = self.output.get("1.0", tk.END).strip()
        if not license_text:
            messagebox.showinfo("DibNova License Generator", "Generate a license first.")
            return
        self.clipboard_clear()
        self.clipboard_append(license_text)
        messagebox.showinfo("DibNova License Generator", "License copied to clipboard.")


def main() -> None:
    app = LicenseGeneratorApp()
    app.mainloop()


if __name__ == "__main__":
    main()
