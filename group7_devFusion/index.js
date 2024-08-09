const questions = require("./modules/test")
const authData = require("./modules/auth-service");
const clientSessions = require("client-sessions");

const express = require('express');
const app = express();
const path = require('path');

const HTTP_PORT = process.env.PORT || 8080;

app.use(express.static('public'));
app.set("views", path.join(__dirname, "views"));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use(
  clientSessions({
    cookieName: 'session', // this is the object name that will be added to 'req'
    secret: 'o6LjQ5EVNC28ZgK64hDELM18ScpFQr', // this should be a long un-guessable string.
    duration: 10 * 60 * 1000, // duration of the session in milliseconds (2 minutes)
    activeDuration: 1000 * 600, // the session will be extended by this many ms each request (1 minute)
  })
);
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Middleware to check for "Remember Me" cookie
function checkRememberMeCookie(req, res, next) {
  if (req.cookies?.rememberMe && !req.session.user) {
    // Decode the cookie and set the session
    const rememberMe = JSON.parse(req.cookies.rememberMe);
    authData.checkUser(rememberMe)
      .then((user) => {
        req.session.user = {
          name: user.name,
          email: user.email
        };
        next();
      })
      .catch((err) => {
        console.error('Invalid remember me cookie', err);
        res.clearCookie('rememberMe');
        next();
      });
  } else {
    next();
  }
}

function redirectToHomeIfRemembered(req, res, next) {
  if (req.session.user) {
    // User is already logged in
    return res.redirect('/Home');
  } else if (req.cookies?.rememberMe) {
    // Check if the "Remember Me" cookie is present and valid
    const rememberMe = JSON.parse(req.cookies.rememberMe);
    authData.checkUser(rememberMe)
      .then((user) => {
        req.session.user = {
          name: user.name,
          email: user.email
        };
        res.redirect('/Home');
      })
      .catch((err) => {
        console.error('Invalid remember me cookie', err);
        res.clearCookie('rememberMe');
        next();
      });
  } else {
    next();
  }
}


// Use this middleware in your app
app.use(checkRememberMeCookie);



function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    next();
  }
}

app.get('/', redirectToHomeIfRemembered, (req, res) => {
  res.render('iOSdev');
});

app.get('/Home', ensureLogin, (req, res) => {
  res.render('homepage', {name: req.session.user?.name});
});

app.get('/UI', redirectToHomeIfRemembered, (req, res) => {
  res.render('UI');
});


// GET route to render the login view
app.get('/Login', redirectToHomeIfRemembered, (req, res) => {
  res.render('Login', { errorMessage: '', email: '' }); 
});

// GET route to render the register view
app.get('/Sign-Up', redirectToHomeIfRemembered, (req, res) => {
  res.render('SignUp', { successMessage:'', errorMessage: '', email: '' }); // Adjust the view name accordingly
});

// GET route for user logout
app.get('/Reset', redirectToHomeIfRemembered, (req, res) => {
  res.render('Reset', { successMessage:'', errorMessage: '' });
});

app.post('/Reset', (req, res) => {
  const { email, password } = req.body;
  authData.resetPassword(email, password)
    .then((message) => res.render('Reset', { successMessage: message, errorMessage: '' }))
    .catch((err) => res.render('Reset', { successMessage:'', errorMessage: err }));
});

// POST route for user registration
app.post('/Sign-Up', (req, res) => {
  if (!req.body.terms) {
    return res.render('SignUp', { 
      successMessage: '', 
      errorMessage: 'You must agree to the Terms and Privacy to sign up.', 
      email: req.body.email 
    });
  }
  authData.registerUser(req.body)
      .then(() => res.render('SignUp', { successMessage: 'User created', errorMessage: '', email: '' }))
      .catch((err) => res.render('SignUp', { successMessage:'', errorMessage: err, email: req.body.email }));
});

const rememberMeDuration = 30 * 24 * 60 * 60 * 1000; // 30 day

app.post('/Login', (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  console.log("logging in");
  authData.checkUser(req.body)
      .then((user) => {
          req.session.user = {
              name: user.name,
              email: user.email
          };

          if (req.body['remember-me']) {
            // Set a cookie for "Remember Me"
            const rememberMeData = {
              email: user.email,
              // You might want to include additional security measures, such as a hashed token
            };
            res.cookie('rememberMe', JSON.stringify(rememberMeData), {
              maxAge: rememberMeDuration,
              httpOnly: true, // Secure the cookie to HTTP only
              secure: process.env.NODE_ENV === 'production' // Use secure cookies in production
            });
          }

          res.redirect('/Home');
      })
      .catch((err) => res.render('login', { errorMessage: err, email: req.body.email }));
});


// GET route for user logout
app.get('/logout', (req, res) => {
  req.session.reset();
  res.clearCookie('rememberMe');
  res.redirect('/');
});

app.get('/Content', ensureLogin, async (req, res) => {
  // fetch progress
  let progress = await authData.fetchProgress(req.session.user.email);
  let index = parseInt(req.query.index, 10) || progress + 1;
  
  if (index == progress + 2){
    progress = index - 1;
    await authData.updateProgress(req.session.user.email, progress);
    //save progress
  }
  if (index > progress + 2)
    index = progress + 1;
  
  if (index > 10)
    index = 10;
  const topics = [
    'Introduction to mobile application development and iOS',
    'Overview of using XCode Swift programming language fundamentals',
    'Fundamentals of iOS Development View Controllers and Lifecycle',
    'Designing screens with UIKit: Common UI controls Labels, TextField, Button, Switch, Image, etc',
    'Handling user events with outlets and actions',
    'Navigation and navigation design patterns',
    'Delegates: Pickers and TableViews',
    'Creating and using databases in iOS applications',
    'Mobile app permissions model Local notifications',
    'Location Services and Mapping'
  ];

  res.render('contentpage', { index, progress, topics });
});

app.get('/complete', ensureLogin, async (req, res) => {
  await authData.updateProgress(req.session.user.email, 10);
  res.redirect('/Home');

});

app.get('/TestInstruction', ensureLogin, async (req, res) => {
  const progress = await authData.fetchProgress(req.session.user.email);
  res.render('TestInstruction', {progress});

});

app.get('/Test', ensureLogin, async (req, res) => {
  const progress = await authData.fetchProgress(req.session.user.email);
  if(progress < 10)
    res.render('TestInstruction', {progress});
  res.render('Test', {questions, req});

});

app.post('/result', async (req, res) => {
  // Assuming 'questions' and correct answers are defined somewhere
  let correctAnswers = 0;
    questions.forEach((question, index) => {
        if (req.body['answer_' + index] == question.answer) {
            correctAnswers++;
        }
    });
    
    const totalQuestions = questions.length;
    const wrongAnswers = totalQuestions - correctAnswers;
    const percentage = (correctAnswers / totalQuestions) * 100;
    const isPass = percentage >= 80;
    if(isPass){
      // Update isPass value for a user
      await authData.updateIsPass(req.session.user.email, true)
      .then(message => {
        console.log(message);
      })
      .catch(err => {
        console.error(err);
      });
    }
    res.render('Result', {
        correctAnswers,
        wrongAnswers,
        percentage,
        isPass
    });
});

app.get('/certificate', async (req, res) => {
  const isPass = await authData.fetchIsPass(req.session.user.email)
  .then(isPass => {
    console.log(`isPass: ${isPass}`);
    return isPass;
  })
  .catch(err => {
    console.error(err);
    return false;
  });
  const userName = req.session.user.name;
  if(isPass)
    res.render('certificate', { userName });
  res.render('homepage', {name: req.session.user?.name});
});

// app.get('/Feedback', ensureLogin, async (req, res) => {
//   res.render('feedback');
// });
app.get('/Feedback', ensureLogin, async (req, res) => {
  try {
    const feedback = await authData.fetchFeedback(req.session.user.email);
    res.render('feedback', { feedback });
  } catch (err) {
    res.render('feedback', { feedback: null }); // Pass null if no feedback exists
  }
});

app.post('/Feedback', ensureLogin, async (req, res) => {
  const feedbackData = {
    message: req.body.comment,
    rating: req.body.rate
  };

  try {
    await authData.addOrUpdateFeedback(req.session.user.email, feedbackData);
    res.redirect('/home'); // Redirect to the home page after saving feedback
  } catch (err) {
    console.error("Error saving feedback: ", err);
    res.render('feedback', { feedback: feedbackData, errorMessage: "There was an error saving your feedback. Please try again." });
  }
});

app.use((req, res) => {
  res.render('homepage', {name: req.session.user?.name});
});

authData.initialize()
.then(()=>{
  app.listen(HTTP_PORT, () => { console.log(`server listening on: ${HTTP_PORT}`) });
}).catch((err) => {
  console.log(`unable to start server: ${err}`);
});

module.exports = app;
