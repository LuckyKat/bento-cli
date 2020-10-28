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
                console.log("copying: " + path.basename(curSource));
                fs.copyFileSync(curSource, path.join(destinationFolder, file));
            }
        });
    }
};

var main = function () {
    var prompt = function () {
        var strings = {
            newProject: "New 2D Bento project...",
            newProject3D: "New 3D Bento project...",
            openDoc: "Open documentation"
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
        console.log('Exited with code ' + code.toString());
        if (onComplete) {
            onComplete();
        }
    });
};
/**
 * Download bento empty project
 */
var newBentoProject = function (branch) {
    var projectName = "";
    var downloadEmptyProject = function (projectName) {
        var request = require('request');
        var AdmZip = require('adm-zip');

        var cwd = process.cwd();
        projectPath = path.join(cwd, projectName);
        var url = 'https://github.com/LuckyKat/Bento-Empty-Project/archive/' + branch + '.zip';
        var download = function () {
            var tmpFilePath = path.join(cwd, "temp.zip");
            console.log("Downloading bento project...");
            request(url)
                .pipe(fs.createWriteStream(tmpFilePath))
                .on('close', function () {
                    var zip = new AdmZip(tmpFilePath);
                    zip.extractAllTo(cwd);
                    console.log("Unarchiving...");

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
            console.log("Installing development tools...");
            commandExists('yarn', function (err, commandExists) {
                if (commandExists) {
                    execCommand('yarn', [], afterInstall);
                } else {
                    execCommand('npm', ['install'], afterInstall);
                }
            });

        };


        var afterInstall = function () {
            // clean up
            console.log("Cleaning up...");
            if (fs.existsSync('readme.md')) {
                fs.unlinkSync('readme.md');
            }
            if (fs.existsSync('changelog.md')) {
                fs.unlinkSync('changelog.md');
            }
            // TODO: optional - clean up package.json with real project name and author
            // could also ask about other game settings
            console.log("Installation complete!");
            console.log("Use the `bento` command in a project folder to view development tasks.");

            var packageJsonStr;
            var packageJson;
            var gameJsStr;
            var configStr;
            var indexStr;
            if (fs.existsSync('package.json')) {
                packageJsonStr = fs.readFileSync(path.join('package.json'), 'utf-8');
                packageJson = JSON.parse(packageJsonStr);

                packageJson.name = projectName;

                fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 4));
            }

            if (fs.existsSync(path.join('js', 'game.js'))) {
                gameJsStr = fs.readFileSync(path.join('js', 'game.js'), 'utf-8');

                gameJsStr = gameJsStr.replace("Bento.saveState.setId('EmptyProject/');", "Bento.saveState.setId('" + projectName + "/');");
                gameJsStr = gameJsStr.replace("name: 'Empty Project',", "name: '" + projectName + "',");

                fs.writeFileSync(path.join('js', 'game.js'), gameJsStr);
            }

            if (fs.existsSync(path.join('config.xml'))) {
                configStr = fs.readFileSync(path.join('config.xml'), 'utf-8');

                configStr = configStr.replace('<name>Bento Empty Project</name>', '<name>' + projectName + '</name>');

                fs.writeFileSync(path.join('config.xml'), configStr);
            }

            if (fs.existsSync(path.join('index.html'))) {
                indexStr = fs.readFileSync(path.join('index.html'), 'utf-8');

                indexStr = indexStr.replace('<title>Empty Project</title>', '<title>' + projectName + '</title>');

                fs.writeFileSync(path.join('index.html'), indexStr);
            }

            // remove git history
            deleteFolderRecursive(path.join('.git'));


            checkForPluginsFolder();
        };
        if (fs.existsSync(projectPath)) {
            console.error('The folder ' + projectName + ' already exists!');
            return;
        }

        download();
    };
    var addPlugins = function (snippet) {
        var cwd = process.cwd();

        // preemptively read out config.xml
        var configXMLPath = path.join(projectPath, 'config.xml');
        var configXMLStr = fs.readFileSync(configXMLPath, 'utf-8');

        //get the path to the plugin folder
        var cordovaPluginsPath = path.join(cwd, 'cordova-plugins/');
        var pluginsSnippetStr;

        //replace stuff in the config xml with our found snippet
        if (fs.existsSync(path.join(cordovaPluginsPath, snippet))) {
            pluginsSnippetStr = fs.readFileSync(path.join(cordovaPluginsPath, snippet), 'utf-8');
            var pluginsLineStart = "<!-- Include plugins here -->";
            configXMLStr = configXMLStr.replace(pluginsLineStart, pluginsLineStart + '\n' + pluginsSnippetStr);
        }

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

            // for each module on the list we just found
            moduleList.forEach(function (moduleFolder) {
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
                    fullSnippet = "\n" + initDataObject.name + ":" + initSnippetStr + ",";
                    initJSStr = initJSStr.replace(functionLineStart, functionLineStart + fullSnippet);
                }
            });
        }

        //write back out the init.js
        fs.writeFileSync(initJSPath, initJSStr);
    };
    var checkForPluginsFolder = function () {
        var moveOn = function () {
            console.log('\n\nYou\'re all set!');
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
            console.log('cordova-plugins not detected.');
            moveOn();
        }
    };
    var askProjectName = function () {
        // ask for project name
        inquirer.prompt([{
            type: 'input',
            name: 'projectName',
            message: "Name your new project (no spaces):"
        }]).then(function (answers) {
            projectName = answers.projectName || "EmptyBentoProject";

            if (projectName.indexOf(' ') >= 0) {
                askProjectName();
                return;
            }
            downloadEmptyProject(projectName);
        });
    };

    branch = branch || 'master';

    askProjectName();
};

main();