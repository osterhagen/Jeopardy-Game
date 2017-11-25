var express = require("express");
var sqlite3 = require("sqlite3");
var bodyParser = require("body-parser");
var jsonWT = require('jsonwebtoken');
var dateandtime = require('date-and-time');

var app = express();

var appRouter = express.Router();
var db = new sqlite3.Database('Data/Jeopardy.db');
app.use( bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

appRouter.get("/", function(req,res) {
    db.get("select * from users",function(e,u){
        return res.json(u);
    })
    return res.send("Hello World");
})

appRouter.post('/auth/signin', function(req, res) {
    var userID = req.body.UserID;
    var password = req.body.UserPassword;
    var params = [userID, password];
    var currentQuery = "SELECT * FROM Users WHERE UserID = ? AND UserPassword = ?";
    db.all(currentQuery, params, function(err, result) {
        if(userID === undefined || password === undefined) {
            return res.status(400).json({message: "invalid_data"});
        }
        else if(JSON.stringify(result).length < 3) {
            return res.status(401).json({message: "invalid_credentials"});
        }else {
            //var authToken = jsonWT.sign(userID, app.get('superSecret'), {expiresInMinutes:1});
            var date = new Date();
            var dates = dateandtime.format(date, 'YYYY/MM/DD HH:mm');
            var authToken = Math.random().toString(26).substring(2); // found online
            var query = " UPDATE Users SET AuthToken = ?, AuthTokenIssued = ? WHERE UserID = ?";
            var params = [authToken, dates+"", userID];
            db.run(query, params);
            //console.log(date + "        " + authToken);
            return res.status(200).json({message: "success", "authToken": authToken});
        }
    });
});

// The reason this method is really obscure is because date-and-time would not format the
// dates well on my machine.
appRouter.use(function (req, res, next) {
    var authToken = req.query.token || req.headers['x-access-token'];
    if (authToken) {
        var query = "SELECT AuthTokenIssued FROM Users WHERE AuthToken = ?";
        var params = [authToken];
        db.all(query, params, function (err, result) {
            if (result.length <= 0){return res.status(400).json({message: "unauthorized access"});}
            var currentTime = dateandtime.format(new Date(), 'YYYY/MM/DD HH:mm') + "";
            var then =result[0].AuthTokenIssued.split(/[\s//:]+/);
            var now = currentTime.split(/[\s//:]+/);
            now[3]+= now[4];
            then[3] += then[4];
            var nowInt = parseFloat(now[3]);
            var thenInt = parseFloat(then[3]);
            if(nowInt-thenInt <= 100 && nowInt-thenInt > 0){
                next();
            }
            else {return res.status(400).json({message: "auth token expired"});}
        });

    }
    else {return res.status(400).json({message: "unauthorized access"});}
});

appRouter.get('/questions', function(req, res) {
    var categoryTitle = req.query.categoryTitle;
    var dollarValue = req.query.dollarValue;
    var questionText = req.query.questionText;
    var answerText = req.query.answerText;
    var showNumber = req.query.showNumber;
    var airDate = req.query.airDate;

    var dbQuery = "select * from Questions join Categories on Questions.CategoryCode = Categories.CategoryCode where ";
    var paramCount = 0;
    var params = [];

    if (categoryTitle != null) {

        if(paramCount > 0) {
            dbQuery = dbQuery + 'and ';
        }

        paramCount++;
        dbQuery = dbQuery + 'CategoryTitle = ? ';
        params.push(categoryTitle.toUpperCase());
    }

    if (dollarValue != null) {

        if(paramCount > 0) {
            dbQuery = dbQuery + 'and ';
        }

        paramCount++;
        dbQuery = dbQuery + 'DollarValue = ? ';
        dollarValue = "$" + dollarValue;
        params.push(dollarValue);
    }

    if (questionText) {

        if(paramCount > 0) {
            dbQuery = dbQuery + 'and ';
        }

        paramCount++;
        dbQuery = dbQuery + 'QuestionText like ? ' ;
        questionText = '%' + questionText + '%';
        params.push(questionText);
    }

    if (answerText) {

        if(paramCount > 0) {
            dbQuery = dbQuery + 'and ';
        }

        paramCount++;
        dbQuery = dbQuery + 'AnswerText = ? ';
        params.push(answerText);
    }

    if (showNumber) {

        if(paramCount > 0) {
            dbQuery = dbQuery + 'and ';
        }

        paramCount++;
        dbQuery = dbQuery + 'ShowNumber = ? ';
        params.push(showNumber);
    }

    if (airDate) {

        if(paramCount > 0) {
            dbQuery = dbQuery + 'and ';
        }

        paramCount++;
        dbQuery = dbQuery + 'AirDate = ? ';
        params.push(airDate);
    }

    dbQuery = dbQuery + 'order by AirDate desc';

    if(paramCount == 0) {
        dbQuery = "select * from Questions order by AirDate desc";
    }

    db.all(dbQuery, params, (err, questions) => {

        if(questions.length > 5000) {
            return res.status(400).json({message: "too_many_results"});
        }

        if (err) {
            console.log(err);
            return res.status(500).json({message: "Internal server error"});
        }

        return res.status(200).json(questions);
    });
});

//not in transaction standard, everything else works
appRouter.post('/questionadd', function(req, res) {
    // getting data
    var categoryCode = req.body.categoryCode;
    var categoryTitle = req.body.categoryTitle;
    var airDate = req.body.airDate;
    var questionText = req.body.questionText;
    var dollarValue = req.body.dollarValue;
    var answerText = req.body.answerText;
    var showNumber = req.body.showNumber;

    // checking inputs
    if (airDate.length < 5 || showNumber < 0 || dollarValue < 100 || dollarValue %100 !== 0 || dollarValue > 2000){
        return res.status(400).json({message: "Query Error! Input correct format"});
    }
    if (questionText.length < 1 || answerText.length < 1 || categoryCode.length < 1 || categoryTitle.length < 1){
        return res.status(400).json({message: "Query Error! Please fill in all categories"});
    }

    // categoryTitle and categoryCode
    var dbQuery = "SELECT * FROM Categories";
    var requestParams = [];
    db.all(dbQuery, requestParams, function(err, result) {
        if(err) {
            return res.status(500).json({message: "Internal server error"});
        }
        for(var i = 0; i < result.length; i++) {
            if (result[i].CategoryCode === categoryCode && result[i].CategoryTitle === categoryTitle) {
                return res.status(400).json({message: "Already In Database"});
            }
            else if (result[i].CategoryCode === categoryCode && result[i].CategoryTitle !== categoryTitle) {
                return res.status(401).json({message: "Invalid Category Title"});
            }
            else if (result[i].CategoryTitle === categoryTitle && result[i].CategoryCode !== categoryCode) {
                return res.status(402).json({message: "Invalid Category Code"});
            }

            else {
                var query = "INSERT INTO Questions (ShowNumber, AirDate, CategoryCode, DollarValue, QuestionText, " +
                    "AnswerText) VALUES (?,?,?,?,?,?);";
                var params = [showNumber, airDate, categoryCode, dollarValue, questionText, answerText];
                db.prepare(query);
                db.run(query, params, function (erre) {
                    if(erre){return res.status(400).json({message: "descriptive error message"});}
                    var queryI = "INSERT INTO Categories (CategoryCode, CategoryTitle) VALUES (?,?);";
                    var paramsI = [categoryCode, categoryTitle];
                    db.prepare(queryI);
                    db.run(queryI, paramsI, function (erres) {
                        if(erres){return res.status(400).json({message: "descriptive error message"});}
                    });
                });
                return res.status(200).json({message: "success"});
            }
        }
    });

});


app.use('', appRouter);
var port = process.env.PORT || 8000;
app.listen(port, function() {
    console.log("Running server on port " + port);
});
