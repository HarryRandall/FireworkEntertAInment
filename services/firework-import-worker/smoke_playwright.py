"""Verify that the worker Chromium can render and read a WebGL pixel."""

from playwright.sync_api import sync_playwright


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--disable-gpu-sandbox",
            ],
        )
        try:
            page = browser.new_page(viewport={"width": 32, "height": 32})
            rendered = page.evaluate(
                """() => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 2;
                  canvas.height = 2;
                  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                  if (!gl) return false;
                  gl.clearColor(1, 0.25, 0, 1);
                  gl.clear(gl.COLOR_BUFFER_BIT);
                  const pixel = new Uint8Array(4);
                  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                  return pixel[0] > 240 && pixel[1] > 40 && pixel[3] === 255;
                }"""
            )
            if not rendered:
                raise RuntimeError("Chromium did not produce a readable WebGL pixel")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
