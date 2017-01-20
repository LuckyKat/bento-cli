var gulp = require('gulp');
var inquirer = require('inquirer');

var exitStr = 'Exit';

var main = function () {
    var strings = {
        newProject: "New Bento project...",
        tasks: "List project tasks..."
    };

    inquirer.prompt([{
        type: 'list',
        name: 'question',
        message: 'What do you want to do?',
        choices: [
            strings.newProject,
            strings.tasks,
            exitStr
        ]
    }]).then(function (answers) {
        if (answers.question === strings.newProject) {
        } else if (answers.question === strings.tasks) {
            gulp.start('default');
        }
    });
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

main();