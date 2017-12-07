var express = require('express');
var sqlite3 = require('sqlite3').verbose();
var bodyParser = require('body-parser');
var cors = require('cors');


var app = express();

var db = new sqlite3.Database('./Jeopardy.db');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({type: 'application/json'}));
app.use(cors());

app.set("views", __dirname);
app.set("view engine", "ejs");

app.get("/", function(req, res) {

    var query = "SELECT * FROM (SELECT DISTINCT ShowNumber, AirDate FROM Questions ORDER BY AirDate DESC LIMIT 25) AS t ORDER BY AirDate ASC";
    var params = [];

    db.all(query, params, (err, result) => {
        //console.log(err);
        res.render("index", {result:result} );
    })
});

app.get('/questions', function(req, res) {
    console.log(req.query);
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

var port = process.env.PORT || 8000;
app.listen(port, function() {
    console.log("Running server on port " + port);
});
