var inquirer = require('inquirer');
var fs = require('fs');
var path = require('path');
var https = require('https');

var exitStr = 'Exit';
var projectPath;

/**
 * Delete an entire folder
 * http://stackoverflow.com/a/32197381/5930772
 */
var deleteFolderRecursive = function (source) {
    if (fs.existsSync(source)) {
        fs.readdirSync(source).forEach(function (file, index) {
            var curPath = path.join(source, file);
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(source);
    }
};

/**
 * Copies an entire folder
 */
var copyFolderRecursive = function (source, destination, ignoreNames) {
    var files = [];

    //check if folder needs to be created or integrated
    var destinationFolder = path.join(destination, path.basename(source));
    if (!fs.existsSync(destinationFolder)) {
        fs.mkdirSync(destinationFolder);
    }

    //copy
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            var curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursive(curSource, destinationFolder);
            } else {
                console.log("\x1b[33m", "Copying File: " + path.basename(curSource));
                fs.copyFileSync(curSource, path.join(destinationFolder, file));
            }
        });
    }
};

/**
 * Gets confirmation from the user about a question
 */
var askConfirmation = function (question, onAccept, onDeny) {
    inquirer.prompt([{
        type: 'list',
        name: 'question',
        message: question,
        choices: [
            'Yes',
            'No'
        ]
    }]).then(function (answers) {
        if (answers.question === 'Yes') {
            if (onAccept) {
                onAccept();
            }
        } else if (answers.question === 'No') {
            if (onDeny) {
                onDeny();
            }
        }
    });
};

/**
 * Executes a general command with logs
 * @param {String} cmd - The command
 * @param {Array} args - an array with arguments
 * @param {Function} [onComplete] - execute after completion
 */
var execCommand = function (cmd, args, onComplete) {
    var spawn = require('child_process').spawn;
    var task = spawn(cmd, args, {
        stdio: "inherit"
    });
    task.on('exit', function (code) {
        console.log("\x1b[31m", 'Exited with code ' + code.toString());
        if (onComplete) {
            onComplete();
        }
    });
};


/**
 * Entry Point
 */
var main = function () {
    console.log("\x1b[36m", "\nBento Command Line Interface 🤖 \n");
    var prompt = function () {
        var strings = {
            newProject: "🕹  New 2D Bento project...",
            newProject3D: "🍙 New 3D Bento project...",
            openDoc: "📖 Open documentation"
        };

        inquirer.prompt([{
            type: 'list',
            name: 'question',
            message: 'What do you want to do?',
            choices: [
                strings.newProject,
                strings.newProject3D,
                strings.openDoc,
                exitStr
            ]
        }]).then(function (answers) {
            if (answers.question === strings.newProject) {
                newBentoProject('master');
            } else if (answers.question === strings.newProject3D) {
                newBentoProject('3D-master');
            } else if (answers.question === strings.openDoc) {
                // open documentation in browser
                var spawn = require('child_process').spawn;
                spawn('open', ['https://luckykat.github.io/Bento/']);
            }
        });
    };


    // Check if cwd is a Bento project
    var cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'gulpfile.js'))) {
        // run local gulp
        var child_process = require('child_process');
        child_process.fork('./node_modules/.bin/gulp');
        // execCommand('./node_modules/.bin/gulp');
        return;
    } else {
        // prompt to create new bento project
        prompt();
    }
};


/**
 * Downloads bento empty project, and configures it
 */
var newBentoProject = function (branch) {
    var projectName = "";

    var askProjectFolder = function () {
        // ask for project name
        inquirer.prompt([{
            type: 'input',
            name: 'projectName',
            message: "Name your project/repo (no spaces):"
        }]).then(function (answers) {
            projectName = answers.projectName || "EmptyBentoProject";

            if (projectName.indexOf(' ') >= 0) {
                askProjectFolder();
                return;
            }
            downloadEmptyProject(projectName);
        });
    };

    var downloadEmptyProject = function (projectName) {
        var request = require('request');
        var AdmZip = require('adm-zip');

        var cwd = process.cwd();
        projectPath = path.join(cwd, projectName);
        var url = 'https://github.com/LuckyKat/Bento-Empty-Project/archive/' + branch + '.zip';


        var download = function () {
            var tmpFilePath = path.join(cwd, "temp.zip");
            console.log("\x1b[33m", "Downloading bento project...");
            request(url)
                .pipe(fs.createWriteStream(tmpFilePath))
                .on('close', function () {
                    var zip = new AdmZip(tmpFilePath);
                    zip.extractAllTo(cwd);
                    console.log("\x1b[33m", "Unarchiving...");

                    // clean up temp zip
                    fs.unlink(tmpFilePath, function () {});

                    fs.renameSync('Bento-Empty-Project-' + branch, projectName);
                    //install();
                    afterInstall();
                });
        };

        var install = function () {
            var commandExists = require('command-exists');

            // enter new directory
            process.chdir(projectPath);
            // call npm install or yarn
            console.log("\x1b[33m", "Installing development tools...");
            commandExists('yarn', function (err, commandExists) {
                if (commandExists) {
                    execCommand('yarn', [], afterInstall);
                } else {
                    execCommand('npm', ['install'], afterInstall);
                }
            });

        };


        var afterInstall = function () {
            var cwd = process.cwd();

            // clean up
            console.log("\x1b[33m", "Cleaning up...");
            if (fs.existsSync('readme.md')) {
                fs.unlinkSync('readme.md');
            }
            if (fs.existsSync('changelog.md')) {
                fs.unlinkSync('changelog.md');
            }

            var packageJsonPath = path.join(projectPath, 'package.json');
            var packageJsonStr;
            var packageJson;
            var gameJsPath = path.join(projectPath, 'js', 'game.js');
            var gameJsStr;
            if (fs.existsSync(packageJsonPath)) {
                packageJsonStr = fs.readFileSync(packageJsonPath, 'utf-8');
                packageJson = JSON.parse(packageJsonStr);

                packageJson.name = projectName;

                console.log("\x1b[33m", "Setting project name in package.json...");

                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4));
            }

            if (fs.existsSync(gameJsPath)) {
                gameJsStr = fs.readFileSync(gameJsPath, 'utf-8');

                gameJsStr = gameJsStr.replace("Bento.saveState.setId('EmptyProject/');", "Bento.saveState.setId('" + projectName + "/');");
                gameJsStr = gameJsStr.replace("name: 'Empty Project',", "name: '" + projectName + "',");


                console.log("\x1b[33m", "Updating game.js with project name ...");

                fs.writeFileSync(gameJsPath, gameJsStr);
            }

            // remove git history
            deleteFolderRecursive(path.join('.git'));

            // further steps
            askDisplayName();
        };
        if (fs.existsSync(projectPath)) {
            console.error('The folder ' + projectName + ' already exists!');
            return;
        }

        download();
    };


    var askDisplayName = function () {
        var cwd = process.cwd();

        // preemptively read out config.xml
        var configXMLPath = path.join(projectPath, 'config.xml');
        var indexHTMLPath = path.join(projectPath, 'config.xml');

        // ask for display name
        inquirer.prompt([{
            type: 'input',
            name: 'displayName',
            message: "What display name would you like to use?:"
        }]).then(function (answers) {
            var displayName = answers.displayName || "Empty Bento Project";

            if (fs.existsSync(configXMLPath)) {
                var configXMLStr = fs.readFileSync(configXMLPath, 'utf-8');
                // replace
                configXMLStr = configXMLStr.replace('<name>Bento Empty Project</name>', '<name>' + displayName + '</name>');

                console.log("\x1b[33m", "Updating config.xml with display name ...");

                //write back out the config.xml
                fs.writeFileSync(configXMLPath, configXMLStr);
            }

            if (fs.existsSync(indexHTMLPath)) {
                var indexHTMLStr = fs.readFileSync(indexHTMLPath, 'utf-8');
                // replace
                indexHTMLStr = indexHTMLStr.replace('<title>Empty Project</title>', '<title>' + displayName + '</title>');
                indexHTMLStr = indexHTMLStr.replace('<title>Onigiri</title>', '<title>' + displayName + '</title>');

                console.log("\x1b[33m", "Updating index.html with display name ...");

                //write back out the config.xml
                fs.writeFileSync(indexHTMLPath, indexHTMLStr);
            }

            askBundleId();
        });

    };


    var askBundleId = function () {
        var cwd = process.cwd();

        // preemptively read out config.xml
        var configXMLPath = path.join(projectPath, 'config.xml');
        // ask for bundleId
        inquirer.prompt([{
            type: 'input',
            name: 'bundleId',
            message: "What Bundle ID would you like to use (e.g. 'com.company.projectname')?:"
        }]).then(function (answers) {
            var bundleId = answers.bundleId || "com.luckykat.app";

            if (fs.existsSync(configXMLPath)) {
                var configXMLStr = fs.readFileSync(configXMLPath, 'utf-8');
                configXMLStr = configXMLStr.replace('id="com.luckykat.app"', 'id="' + bundleId + '"');

                console.log("\x1b[33m", "Updating config.xml with bundle ID...");

                //write back out the config.xml
                fs.writeFileSync(configXMLPath, configXMLStr);
            }

            checkForPluginsFolder();
        });
    };

    var checkForPluginsFolder = function () {
        var moveOn = function () {
            console.log("\x1b[32m", '\n\nYou\'re all set! 👍');
            console.log("\x1b[37m", "\nUse the `bento` command in a project folder to view development tasks.");
        };
        var cwd = process.cwd();
        if (fs.existsSync(path.join(cwd, 'cordova-plugins/')) && fs.existsSync(path.join(cwd, 'bento-modules/'))) {
            askConfirmation('cordova-plugins and bento-modules detected, would you like to install the default plugins and modules?', function () {
                addPlugins('default');
                addModulesFromList('default');
                moveOn();
            }, function () {
                console.log("okay...");
                moveOn();
            });
        } else {
            console.log('cordova-plugins or bento-modules not detected.');
            moveOn();
        }
    };

    var addPlugins = function (snippet) {
        var cwd = process.cwd();

        // preemptively read out config.xml
        var configXMLPath = path.join(projectPath, 'config.xml');
        var configXMLStr = fs.readFileSync(configXMLPath, 'utf-8');

        //get the path to the plugin folder
        var cordovaPluginsPath = path.join(cwd, 'cordova-plugins/');
        var pluginsSnippetStr;
        console.log("\x1b[33m", "\n Plugins: ");
        //replace stuff in the config xml with our found snippet
        if (fs.existsSync(path.join(cordovaPluginsPath, snippet))) {
            pluginsSnippetStr = fs.readFileSync(path.join(cordovaPluginsPath, snippet), 'utf-8');
            var pluginsLineStart = "<!-- Include plugins here -->";
            configXMLStr = configXMLStr.replace(pluginsLineStart, pluginsLineStart + '\n' + pluginsSnippetStr);
        }
        console.log("\x1b[33m", "Adding plugin snippet to config.xml ...");

        //write back out the config.xml
        fs.writeFileSync(configXMLPath, configXMLStr);
    };

    var addModulesFromList = function (list) {
        var cwd = process.cwd();

        // preemptively read out init.js
        var initJSPath = path.join(projectPath, 'js', 'init.js');
        var initJSStr = fs.readFileSync(initJSPath, 'utf-8');

        //get the path to the modeuls folder
        var bentoModulesPath = path.join(cwd, 'bento-modules/');
        var moduleListStr;
        var moduleList = [];

        if (fs.existsSync(path.join(bentoModulesPath, list + '.json'))) {
            moduleListStr = fs.readFileSync(path.join(bentoModulesPath, list + '.json'), 'utf-8');
            moduleList = JSON.parse(moduleListStr);

            console.log("\x1b[33m", "\n Modules: ");

            // for each module on the list we just found
            moduleList.forEach(function (moduleFolder) {

                console.log("\x1b[33m", "\n Adding Module: " + moduleFolder);

                var modulePath = path.join(bentoModulesPath, moduleFolder);
                //copy everything over
                var jsPath = path.join(modulePath, 'js');
                if (fs.existsSync(jsPath)) {
                    copyFolderRecursive(jsPath, projectPath);
                }
                var assetsPath = path.join(modulePath, 'assets');
                if (fs.existsSync(assetsPath)) {
                    copyFolderRecursive(assetsPath, projectPath);
                }
                var scriptsPath = path.join(modulePath, 'scripts');
                if (fs.existsSync(scriptsPath)) {
                    copyFolderRecursive(scriptsPath, projectPath);
                }
                var libPath = path.join(modulePath, 'lib');
                if (fs.existsSync(libPath)) {
                    copyFolderRecursive(libPath, projectPath);
                }
                var miscPath = path.join(modulePath, 'misc');
                if (fs.existsSync(miscPath)) {
                    copyFolderRecursive(miscPath, projectPath);
                }

                //get the data and snippet
                var initData = path.join(modulePath, 'init.json');
                var initDataStr;
                var initDataObject;
                if (fs.existsSync(initData)) {
                    initDataStr = fs.readFileSync(initData, 'utf-8');
                    initDataObject = JSON.parse(initDataStr);
                }
                var initSnippet = path.join(modulePath, 'init.js');
                var initSnippetStr;
                if (fs.existsSync(initSnippet)) {
                    initSnippetStr = fs.readFileSync(initSnippet, 'utf-8');
                }

                // replace stuff
                var functionLineStart = "var initFunctions = {";
                var fullSnippet = "";
                if (initDataObject && initDataObject.name && initSnippetStr) {
                    console.log("\x1b[33m", "Adding Init Snippet to init.js ...");
                    fullSnippet = "\n" + initDataObject.name + ":" + initSnippetStr + ",";
                    initJSStr = initJSStr.replace(functionLineStart, functionLineStart + fullSnippet);
                }
            });
        }

        //write back out the init.js
        fs.writeFileSync(initJSPath, initJSStr);
    };

    branch = branch || 'master';

    askProjectFolder();
};

main();