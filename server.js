var express = require('express');
var sqlite3 = require('sqlite3').verbose();
var bodyParser = require('body-parser');
var cors = require('cors');

var app = express();

var db = new sqlite3.Database('Jeopardy.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({type: 'application/json'}));
app.use(cors());


app.get("/", function(req, res) {
  var query = "SELECT * FROM (SELECT DISTINCT ShowNumber, AirDate FROM Questions ORDER BY AirDate DESC LIMIT 50) AS t ORDER BY AirDate ASC";
  var params = [];

  db.all(query, params, (err, result) => {
    return res.status(200).json(result);
  })
});

app.get('/questions', function(req, res) {
    var showNumber = req.query.showNumber;
    var airDate = req.query.airDate;

    var dbQuery = "SELECT DollarValue, QuestionText, AnswerText, CategoryTitle FROM Questions JOIN Categories ON Questions.CategoryCode = Categories.CategoryCode WHERE ";
    var paramCount = 0;
    var params = [];

    if (showNumber) {

        if(paramCount > 0) {
            dbQuery = dbQuery + 'AND ';
        }

        paramCount++;
        dbQuery = dbQuery + 'ShowNumber = ? ';
        params.push(showNumber);
    }

    if (airDate) {

        if(paramCount > 0) {
            dbQuery = dbQuery + 'AND ';
        }

        paramCount++;
        dbQuery = dbQuery + 'AirDate = ? ';
        params.push(airDate);
    }

    dbQuery = dbQuery + 'ORDER BY AirDate desc';

    if(paramCount == 0) {
        dbQuery = "SELECT * FROM Questions ORDER BY AirDate DESC";
    }
    dbQuery += ' LIMIT 30';
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
app.post('/questionadd', function(req, res) {
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



var port = process.env.PORT || 8000;
app.listen(port, function() {
    console.log("Running server on port " + port);
});
