# Flutter ARB Translation Helper

> VS Code extension for managing translations in Flutter project

## Features

- ✨ Quick fix provider for untranslated strings
- 🔄 Automatic ARB files update
- 🌐 English & Bahasa Indonesia support  
- ⚡️ Auto runs `flutter gen-l10n`
- 💡 Smart translation key suggestions

## Requirements

- VS Code ^1.97.0
- Flutter project with ARB structure:

```text
assets/
  l10n/
    talenta_en.arb
    talenta_id.arb
```

## Installation

1. Download VSIX file
2. Install via VS Code:

```bash
code --install-extension flutter-arb-localization-helper-0.0.1.vsix
```

Or via Command Palette:
1. `Cmd+Shift+P`
2. Select "Install from VSIX"
3. Choose downloaded VSIX

## Usage

1. Open Dart file in Flutter project
2. Hover over untranslated string
3. Click lightbulb (⚡) or `Cmd+.`
4. Select "Add Translation"
5. Enter requested info:
   - Translation key (e.g. `labelSubmit`) 
   - English text
   - Bahasa text

The extension will automatically:
- Update ARB files
- Run code generation
- Create translation classes

### Example

Before:
```dart
Text('Submit'),
```

After:
```dart
Text(localizations.labelSubmit),
```

Updated ARB files:
```json
// talenta_en.arb
{
  "labelSubmit": "Submit"
}

// talenta_id.arb
{
  "labelSubmit": "Kirim"
}
```

## Development

1. Clone repo
2. Install deps:
```bash
npm install
```

3. Run dev mode:
```bash 
npm run watch
```

4. Press F5 in VS Code to debug

## Contributing

1. Fork repo
2. Create feature branch
```bash
git checkout -b feature/amazing-feature
```

3. Commit changes
```bash
git commit -m 'Add amazing feature'
```

4. Push branch
```bash
git push origin feature/amazing-feature
```

5. Open Pull Request

## License

MIT License. See [LICENSE](LICENSE)

## Author

Your Name - [@naufaldirfq](https://github.com/naufaldirfq)

[https://github.com/naufaldirfq/flutter-arb-localization-helper](https://github.com/naufaldirfq/flutter-arb-localization-helper)