import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // Register the command handler
    let disposable = vscode.commands.registerCommand('flutter-arb-localization-helper.addTranslation', addTranslation);
    context.subscriptions.push(disposable);

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
        const untranslatedStringRegex = /'([^']+)'/g;

        const matches = [...line.text.matchAll(untranslatedStringRegex)];
        const actions: vscode.CodeAction[] = [];

        for (const match of matches) {
            const text = match[1];
            const existingKey = this.findExistingKey(text);
            
            if (existingKey) {
                // Create action to use existing translation
                const action = new vscode.CodeAction(
                    `Use existing translation key: '${existingKey}'`,
                    vscode.CodeActionKind.QuickFix
                );
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(
                    document.uri,
                    new vscode.Range(
                        new vscode.Position(range.start.line, match.index!),
                        new vscode.Position(range.start.line, match.index! + match[0].length)
                    ),
                    `AppLocalizations.of(context).${existingKey}`
                );
                actions.push(action);
            } else {
                // Create action to add new translation
                const action = new vscode.CodeAction(
                    `Add translation for '${text}'`,
                    vscode.CodeActionKind.QuickFix
                );
                action.command = {
                    command: 'flutter-arb-localization-helper.addTranslation',
                    title: 'Add Translation',
                    arguments: [text]
                };
                actions.push(action);
            }
        }

        return actions;
    }

    private findExistingKey(text: string): string | null {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return null;

            const enArbPath = path.join(workspaceFolder.uri.fsPath, 'talenta', 'assets', 'l10n', 'talenta_en.arb');
            if (!fs.existsSync(enArbPath)) return null;

            const enArb = JSON.parse(fs.readFileSync(enArbPath, 'utf8'));
            
            // Find the key for the given text
            for (const [key, value] of Object.entries(enArb)) {
                if (value === text) {
                    return key;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error finding existing key:', error);
            return null;
        }
    }

    private isTranslated(text: string): boolean {
        const existingKey = this.findExistingKey(text);
        return existingKey !== null;
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
        const terminal = vscode.window.terminals.length > 0
            ? vscode.window.activeTerminal || vscode.window.terminals[0]
            : vscode.window.createTerminal('Flutter L10n');

        terminal.sendText('flutter gen-l10n');
        terminal.show();
    }
}

function updateArbFiles(key: string, enText: string, idText: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const enArbPath = path.join(workspaceFolder.uri.fsPath, 'talenta', 'assets', 'l10n', 'talenta_en.arb');
    const idArbPath = path.join(workspaceFolder.uri.fsPath, 'talenta', 'assets', 'l10n', 'talenta_id.arb');

    try {
        // Update English ARB
        let enArb: { [key: string]: string } = {};
        if (fs.existsSync(enArbPath)) {
            enArb = JSON.parse(fs.readFileSync(enArbPath, 'utf8'));
        }
        enArb[key] = enText;
        fs.writeFileSync(enArbPath, JSON.stringify(enArb, null, 2));

        // Update Bahasa ARB
        let idArb: { [key: string]: string } = {};
        if (fs.existsSync(idArbPath)) {
            idArb = JSON.parse(fs.readFileSync(idArbPath, 'utf8'));
        }
        idArb[key] = idText;
        fs.writeFileSync(idArbPath, JSON.stringify(idArb, null, 2));

        vscode.window.showInformationMessage('Translation files updated successfully');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update translation files: ${error}`);
    }
}