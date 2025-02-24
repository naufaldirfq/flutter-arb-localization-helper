import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // Register Quick Fix provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('dart', new TranslationQuickFixProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );
}

class TranslationQuickFixProvider implements vscode.CodeActionProvider {
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range
    ): vscode.CodeAction[] {
        const line = document.lineAt(range.start.line);
        const untranslatedStringRegex = /'([^']+)'/g; // Detect strings in single quotes
        
        const matches = [...line.text.matchAll(untranslatedStringRegex)];
        const actions: vscode.CodeAction[] = [];

        for (const match of matches) {
            const text = match[1];
            if (!this.isTranslated(text)) {
                const action = new vscode.CodeAction(
                    `Add translation for '${text}'`,
                    vscode.CodeActionKind.QuickFix
                );
                action.command = {
                    command: 'talenta.addTranslation',
                    title: 'Add Translation',
                    arguments: [text]
                };
                actions.push(action);
            }
        }

        return actions;
    }

    private isTranslated(text: string): boolean {
        // Check if string exists in ARB files
        const enArbPath = '/path/to/talenta_en.arb';
        const idArbPath = '/path/to/talenta_id.arb';
        
        const enArb = JSON.parse(fs.readFileSync(enArbPath, 'utf8'));
        return Object.values(enArb).includes(text);
    }
}

async function addTranslation(text: string) {
    // Show input dialog
    const keyName = await vscode.window.showInputBox({
        prompt: 'Enter translation key name',
        placeHolder: 'e.g., labelSomething'
    });

    const enTranslation = await vscode.window.showInputBox({
        prompt: 'Enter English translation',
        value: text
    });

    const idTranslation = await vscode.window.showInputBox({
        prompt: 'Enter Bahasa translation'
    });

    if (keyName && enTranslation && idTranslation) {
        // Update ARB files
        updateArbFiles(keyName, enTranslation, idTranslation);
        
        // Run flutter gen-l10n
        const terminal = vscode.window.createTerminal('Flutter L10n');
        terminal.sendText('flutter gen-l10n');
        terminal.show();
    }
}

function updateArbFiles(key: string, enText: string, idText: string) {
    const enArbPath = '/path/to/talenta_en.arb';
    const idArbPath = '/path/to/talenta_id.arb';

    // Update English ARB
    const enArb = JSON.parse(fs.readFileSync(enArbPath, 'utf8'));
    enArb[key] = enText;
    fs.writeFileSync(enArbPath, JSON.stringify(enArb, null, 4));

    // Update Bahasa ARB
    const idArb = JSON.parse(fs.readFileSync(idArbPath, 'utf8'));
    idArb[key] = idText;
    fs.writeFileSync(idArbPath, JSON.stringify(idArb, null, 4));
}