# Generate TTS MP3

This guide documents the local flow used to generate text-to-speech audio as an MP3 on macOS.

## Tools

- `say`: macOS built-in text-to-speech command.
- `lame`: MP3 encoder installed through Homebrew.

Check that both tools are available:

```bash
which say
which lame
```

## Thai TTS Example

Generate an intermediate AIFF file with the Thai `Kanya` voice:

```bash
say -v Kanya -o /tmp/thai_welcome_game.aiff "สวัสดีคะยินดีต้อนรับเข้าสู่เกมส์ของเรา"
```

Convert the AIFF file to MP3:

```bash
lame --quiet /tmp/thai_welcome_game.aiff thai-welcome-game.mp3
```

The MP3 will be written to the current working directory.

## English TTS Example

Generate an intermediate AIFF file with the default system voice:

```bash
say -o /tmp/english_welcome.aiff "Hello Welcome to Thai Warewolf comunity"
```

Convert the AIFF file to MP3:

```bash
lame --quiet /tmp/english_welcome.aiff welcome-thai-warewolf-community.mp3
```

## Notes

- Use `say -v '?'` to list installed voices.
- For Thai audio, use `-v Kanya` if that voice is installed.
- `ffmpeg` can also convert AIFF to MP3, but the local Homebrew `ffmpeg` install may fail if one of its codec libraries is missing.
