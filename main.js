const express = require('express');
const hbs = require('hbs');
require('pkginfo')(module, 'author');

const port = process.env.PORT || 80;

var Client = require('node-wolfram');
var Wolfram = new Client('7J27YY-Q896A3LWJ6');

var app = express();

hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.use('/static', express.static(__dirname + '/public'));


hbs.registerHelper('getCurrentYear', () => {
    return new Date().getFullYear();
});

hbs.registerHelper('author', () => {
    return module.exports.author;
});

var asyncWolf = (query) => {
    return new Promise((resolve, reject) => {
        Wolfram.query(query, function(err, result) {
            if (err || result.queryresult.$.success == "false" || result.queryresult.$.error == "true") {
                reject('Error: ' + err);
            } else {
                for (var a = 0; a < result.queryresult.pod.length; a++) {
                    var pod = result.queryresult.pod[a];
                    if (pod.$.title == "Implicit plot" || pod.$.title == "Inequality plot" || pod.$.title == "Plot of solution set") {
                        resolve(pod.subpod[0].img[0].$.src);
                    }
                }
                reject('Error: ' + err);
                //resolve(result.queryresult.pod[2].subpod[0].img[0].$.src);
            }
        });
    });
};

var asyncWolfR = (query) => {
    return new Promise((resolve, reject) => {
        Wolfram.query(query, function(err, result) {
            console.log(JSON.stringify(result,undefined,2));
            if (err || result.queryresult.$.success == "false" || result.queryresult.$.error == "true" || !result.queryresult.pod) {
                reject('Error: ' + err);
            } else {
                for (var a = 0; a < result.queryresult.pod.length; a++) {
                    var pod = result.queryresult.pod[a];
                    if (pod.$.title == "Result") {
                        resolve(pod.subpod[0].plaintext[0]);
                    }
                }
                reject('Error: ' + err);
                //resolve(result.queryresult.pod[2].subpod[0].img[0].$.src);
            }
        });
    });
};

hbs.registerHelper('wolfram', () => {
    asyncWolf("10x+3y=30").then((result) => {
        console.log(result);
        return result;
    }, (errorMessage) => {
        return errorMessage;
    });
    //return 'http://www4b.wolframalpha.com/Calculate/MSP/MSP4297226792eid324g11200001e0edih614i2ef31?MSPStoreType=image/gif&s=14';

});



app.get('/', (req, res) => {
    res.render('index.hbs');
});

app.get('/query/:data', (req, res) => {
    //console.log(Buffer.from(req.params.data, 'base64').toString('ascii'));
    var data = JSON.parse(Buffer.from(req.params.data, 'base64').toString('ascii'));
    console.log(JSON.stringify(data,undefined,2));
    var r = "";

    var q = "";
    for (var a = 0; a < data.count - 1; a++) {
        q = q + `${data.constraints[a].x}x + ${data.constraints[a].y}y = ${data.constraints[a].c}, `;
    }

    q = q + `${data.constraints[data.count-1].x}x + ${data.constraints[data.count-1].y}y = ${data.constraints[data.count-1].c} `;
    console.log(q);

    asyncWolf(`${q}`).then((result) => {
        //console.log(result);
        //lines graphics
        r = `<div class="container_result_image span4"><p class="instrucciones">Constraints graphic</p><br><img src="${result}" alt="solve result"></div>`;

        var q = "Plot[";
        var s = "";
        for (var a = 0; a < data.count-1; a++) {

            switch(data.constraints[a].s)
            {
                case '1': s = '>=';
                break;
                case '0': s = '=';
                break;
                case '-1': s = '<=';
                break;
            }
            q = q + `${data.constraints[a].x}x + ${data.constraints[a].y}y ${s} ${data.constraints[a].c} and `;
        }
        switch(data.constraints[data.count-1].s)
            {
                case '1': s = '>=';
                break;
                case '0': s = '=';
                break;
                case '-1': s = '<=';
                break;
            }

        q = q + `${data.constraints[data.count-1].x}x + ${data.constraints[data.count-1].y}y ${s} ${data.constraints[data.count-1].c} and x>=0 and y>=0] `;
        console.log(q);

        asyncWolf(`${q}`).then((result) => {
            //console.log(result);
            //area graphic
            r += `<div class="container_result_image span4"><p class="instrucciones">Factible region graphic</p><br><img src="${result}" alt="solve result"></div>`;

            //LinearProgramming[{-2,-3},{{4,5},{6,7}},{{88,-1},{99,-1}}]
            var q = `N[LinearProgramming[{ ${data.x*data.obj},${data.y*data.obj}},{`;

            for(var a = 0; a < data.count-1; a++)
            {
                q = q + `{${data.constraints[a].x},${data.constraints[a].y}},`;
            }

            q = q + `{${data.constraints[data.count-1].x},${data.constraints[data.count-1].y}}},{`;
             
            for(var a = 0; a < data.count-1; a++)
            {
                q = q + `{${data.constraints[a].c},${data.constraints[a].s}},`;
            }

            q = q + `{${data.constraints[data.count-1].c},${data.constraints[data.count-1].s}}}]]`;
            console.log(q);
            asyncWolfR(`${q}`).then((result) => {
                console.log(result);
                var rx = /{(.*),(.*)}/g; // regular expression
                var arr = rx.exec(result);
                console.log(arr);
                console.log(data.x * arr[1] + data.y * arr[2]);
                //Optimal result
                r += `<div class="container_result_image span4"><p class="instrucciones">Objective function result: ${result}</p><br><p class="instrucciones">Optimum result: ${data.x * arr[1] + data.y * arr[2]}</p></div>`;


                res.send(r);
            }, (errorMessage) => {
                console.log(errorMessage);
                res.send(`<img src="/static/img/error.png" alt="solve result">`);
            });

        }, (errorMessage) => {
            console.log(errorMessage);
            res.send(`<img src="/static/img/error.png" alt="solve result">`);
        });


    }, (errorMessage) => {
        console.log(errorMessage);
        res.send(`<img src="/static/img/error.png" alt="solve result">`);
    });
});

app.listen(port);
console.log(`Server listening on port ${port}`);