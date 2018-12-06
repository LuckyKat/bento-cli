var inquirer = require('inquirer');
var fs = require('fs');
var path = require('path');
var https = require('https');

var exitStr = 'Exit';

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

var main = function () {
    var prompt = function () {
        var strings = {
            newProject: "New Bento project...",
            openDoc: "Open documentation"
        };

        inquirer.prompt([{
            type: 'list',
            name: 'question',
            message: 'What do you want to do?',
            choices: [
                strings.newProject,
                strings.openDoc,
                exitStr
            ]
        }]).then(function (answers) {
            if (answers.question === strings.newProject) {
                newBentoProject();
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
var newBentoProject = function () {
    var projectName = "";
    var downloadEmptyProject = function (projectName) {
        var request = require('request');
        var AdmZip = require('adm-zip');

        var cwd = process.cwd();
        var projectPath = path.join(cwd, projectName);
        var url = 'https://github.com/LuckyKat/Bento-Empty-Project/archive/master.zip';
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

                    fs.renameSync('Bento-Empty-Project-master', projectName);
                    install();
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

        };
        if (fs.existsSync(projectPath)) {
            console.error('The folder ' + projectName + ' already exists!');
            return;
        }

        download();
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

    askProjectName();
};

main();