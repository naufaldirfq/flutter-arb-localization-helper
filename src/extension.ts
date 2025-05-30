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
    public async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<vscode.CodeAction[]> {
        const line = document.lineAt(range.start.line);
        const untranslatedStringRegex = /'([^']+)'/g;

        const matches = [...line.text.matchAll(untranslatedStringRegex)];
        const actions: vscode.CodeAction[] = [];

        for (const match of matches) {
            const text = match[1];
            const existingKey = await this.findExistingKey(text);
            
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
            }
            
            // Always offer the option to add a new translation
            const addAction = new vscode.CodeAction(
                existingKey 
                    ? `Create alternate translation for '${text}'` 
                    : `Add translation for '${text}'`,
                vscode.CodeActionKind.QuickFix
            );
            addAction.command = {
                command: 'flutter-arb-localization-helper.addTranslation',
                title: 'Add Translation',
                arguments: [text]
            };
            actions.push(addAction);
        }

        return actions;
    }

    private async findExistingKey(text: string): Promise<string | null> {
        try {
            const arbPaths = await findArbFiles();
            if (!arbPaths) return null;

            const enArbPath = path.join(arbPaths.basePath, arbPaths.baseFile);
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

    private async isTranslated(text: string): Promise<boolean> {
        const existingKey = await this.findExistingKey(text);
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

// Cache for ARB file paths to improve performance
let cachedArbPaths: { basePath: string, baseFile: string, targetFile: string } | null = null;

// Function to find ARB files in the project
async function findArbFiles(): Promise<{ basePath: string, baseFile: string, targetFile: string } | null> {
    // Return cached paths if available
    if (cachedArbPaths) {
        return cachedArbPaths;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return null;
    }

    // Get config or use defaults
    const config = vscode.workspace.getConfiguration('flutterArb');
    const configPath = config.get<string>('l10nPath');
    const configBaseFile = config.get<string>('baseArbFile');
    const configTargetFile = config.get<string>('targetArbFile');

    // If config is set, use it directly
    if (configPath && configBaseFile && configTargetFile) {
        const basePath = path.join(workspaceFolder.uri.fsPath, configPath);
        if (fs.existsSync(basePath)) {
            const baseFilePath = path.join(basePath, configBaseFile);
            const targetFilePath = path.join(basePath, configTargetFile);
            
            if (fs.existsSync(baseFilePath) && fs.existsSync(targetFilePath)) {
                cachedArbPaths = { basePath, baseFile: configBaseFile, targetFile: configTargetFile };
                return cachedArbPaths;
            }
        }
    }

    // Common paths for ARB files in Flutter projects
    const commonPaths = [
        'lib/l10n',
        'assets/l10n',
        'assets/localization',
        'assets/i18n',
        'res/l10n',
        'resources/l10n',
        'talenta/assets/l10n', // Keep original path for backward compatibility
    ];

    // Try common paths
    for (const relativePath of commonPaths) {
        const dirPath = path.join(workspaceFolder.uri.fsPath, relativePath);
        if (fs.existsSync(dirPath)) {
            try {
                const files = fs.readdirSync(dirPath);
                const arbFiles = files.filter(file => file.endsWith('.arb'));
                
                if (arbFiles.length >= 2) {
                    // Try to find English and Indonesian files
                    const enFile = arbFiles.find(f => f.includes('_en.') || f.includes('en_') || f.includes('en.'));
                    const idFile = arbFiles.find(f => f.includes('_id.') || f.includes('id_') || f.includes('id.'));
                    
                    if (enFile && idFile) {
                        cachedArbPaths = { basePath: dirPath, baseFile: enFile, targetFile: idFile };
                        return cachedArbPaths;
                    }
                    
                    // If specific language files not found, use the first two files
                    if (arbFiles.length >= 2) {
                        cachedArbPaths = { basePath: dirPath, baseFile: arbFiles[0], targetFile: arbFiles[1] };
                        return cachedArbPaths;
                    }
                }
            } catch (error) {
                console.error(`Error searching directory ${dirPath}:`, error);
            }
        }
    }

    // Search for ARB files in the entire project as a last resort
    try {
        const foundArbFiles = await vscode.workspace.findFiles('**/*.arb', '**/node_modules/**', 10);
        if (foundArbFiles.length >= 2) {
            const arbFileNames = foundArbFiles.map(uri => path.basename(uri.fsPath));
            const enFile = arbFileNames.find(f => f.includes('_en.') || f.includes('en_') || f.includes('en.'));
            const idFile = arbFileNames.find(f => f.includes('_id.') || f.includes('id_') || f.includes('id.'));
            
            if (enFile && idFile) {
                const basePath = path.dirname(foundArbFiles[0].fsPath);
                cachedArbPaths = { basePath, baseFile: enFile, targetFile: idFile };
                return cachedArbPaths;
            }
            
            // Use first two files if language-specific files not found
            const basePath = path.dirname(foundArbFiles[0].fsPath);
            cachedArbPaths = { 
                basePath, 
                baseFile: path.basename(foundArbFiles[0].fsPath), 
                targetFile: path.basename(foundArbFiles[1].fsPath) 
            };
            return cachedArbPaths;
        }
    } catch (error) {
        console.error('Error searching for ARB files:', error);
    }

    return null;
}

async function updateArbFiles(key: string, enText: string, idText: string) {
    const arbPaths = await findArbFiles();
    
    if (!arbPaths) {
        const result = await vscode.window.showErrorMessage(
            'Could not find ARB files in your project. Do you want to specify the location?',
            'Yes', 'No'
        );
        
        if (result === 'Yes') {
            // Open settings
            await vscode.commands.executeCommand('workbench.action.openSettings', 'flutterArb');
        }
        return;
    }

    const enArbPath = path.join(arbPaths.basePath, arbPaths.baseFile);
    const idArbPath = path.join(arbPaths.basePath, arbPaths.targetFile);

    try {
        // Update English ARB
        let enArb: { [key: string]: string } = {};
        if (fs.existsSync(enArbPath)) {
            enArb = JSON.parse(fs.readFileSync(enArbPath, 'utf8'));
        }
        enArb[key] = enText;
        fs.writeFileSync(enArbPath, JSON.stringify(enArb, null, 2));

        // Update Target language ARB
        let idArb: { [key: string]: string } = {};
        if (fs.existsSync(idArbPath)) {
            idArb = JSON.parse(fs.readFileSync(idArbPath, 'utf8'));
        }
        idArb[key] = idText;
        fs.writeFileSync(idArbPath, JSON.stringify(idArb, null, 2));

        vscode.window.showInformationMessage(`Translation files updated successfully in ${path.basename(arbPaths.basePath)}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update translation files: ${error}`);
    }
}