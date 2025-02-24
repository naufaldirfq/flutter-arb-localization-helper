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
                    command: 'flutterArb.addTranslation',
                    title: 'Add Translation',
                    arguments: [text]
                };
                actions.push(action);
            }
        }

        return actions;
    }

    private isTranslated(text: string): boolean {
        try {
            // Get the workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return true;
    
            // Construct paths to ARB files
            const enArbPath = path.join(workspaceFolder.uri.fsPath, 'lib', 'l10n', 'talenta_en.arb');
            const idArbPath = path.join(workspaceFolder.uri.fsPath, 'lib', 'l10n', 'talenta_id.arb');
    
            // Check if files exist
            if (!fs.existsSync(enArbPath) || !fs.existsSync(idArbPath)) {
                return true;
            }
    
            const enArb = JSON.parse(fs.readFileSync(enArbPath, 'utf8'));
            return Object.values(enArb).includes(text);
        } catch (error) {
            console.error('Error checking translation:', error);
            return true;
        }
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
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const enArbPath = path.join(workspaceFolder.uri.fsPath, 'lib', 'l10n', 'talenta_en.arb');
    const idArbPath = path.join(workspaceFolder.uri.fsPath, 'lib', 'l10n', 'talenta_id.arb');

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
        vscode.window.showErrorMessage('Failed to update translation files');
    }
}