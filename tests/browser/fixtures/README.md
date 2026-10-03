# Reference clock clip

`reference-clock.webm` is a generated eight-second 160 × 90 px test pattern at
30 frames per second, without audio or real footage. Generate it with:

```sh
ffmpeg -f lavfi -i 'testsrc2=size=160x90:rate=30:duration=8' -c:v libvpx -b:v 40k -an -y tests/browser/fixtures/reference-clock.webm
```

It exercises local video decoding, seeking and playback beside the draft. It does
not represent measured firework shot timings.
