const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

require('dotenv').config();

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  }
});

let User;

// Initialize function
function initialize() {
  return new Promise(function (resolve, reject) {
    let db = mongoose.createConnection(process.env.MONGODB);
      
      db.on('error', (err) => {
          reject(err); // reject the promise with the provided error
      });
      db.once('open', () => {
          User = db.model("users", userSchema);
          console.log("db connected")
          resolve();
      });
  });
}

// Register User function
function registerUser(userData) {
  return new Promise(function (resolve, reject) {
    if (userData.password.length < 8) {
      return reject("Password must be at least 8 characters long");
    }
    bcrypt.hash(userData.password, 10).then( hash => {
      userData.password = hash;
      userData.progress = 0; // Initialize progress to 0
      let newUser = new User(userData);
      newUser.save()
          .then(() => resolve())
          .catch((err) => {
              if (err.code === 11000) {
                  reject("email already taken");
              } else {
                  reject("There was an error creating the user: " + err);
              }
          });
    })
  });
}

// Check User function
function checkUser(userData) {
  return new Promise(function (resolve, reject) {
      User.find({ email: userData.email })
          .then((users) => {
              if (users.length === 0) {
                  reject("Unable to find user: " + userData.email);
              } else {
                bcrypt.compare(userData.password, users[0].password)
                .then((result) => {
                  if (!result) {
                      reject("Incorrect Password for user: " + userData.email);
                  }
                  resolve(users[0]);
                }).catch((err) => reject("There was an error verifying the user: " + err));
            }
          })
          .catch(() => reject("Unable to find user: " + userData.email));
  });
}

// Reset Password function
function resetPassword(email, newPassword) {
  return new Promise((resolve, reject) => {
    if (newPassword.length < 8) {
      return reject("Password must be at least 8 characters long");
    }
    User.findOne({ email: email }).then(user => {
      if (!user) {
        return reject("No user found with that email address");
      }
      bcrypt.hash(newPassword, 10).then(hash => {
        user.password = hash;
        user.save()
          .then(() => resolve("Password updated successfully"))
          .catch((err) => reject("There was an error updating the password: " + err));
      });
    }).catch((err) => reject("There was an error finding the user: " + err));
  });
}

// Fetch Progress function
function fetchProgress(email) {
  return new Promise((resolve, reject) => {
    User.findOne({ email: email }).then(user => {
      if (!user) {
        return reject("No user found with that email address");
      }
      resolve(user.progress);
    }).catch((err) => reject("There was an error finding the user: " + err));
  });
}

// Update Progress function
function updateProgress(email, newProgress) {
  return new Promise((resolve, reject) => {
    if (newProgress < 0 || newProgress > 10) {
      return reject("Progress must be between 0 and 10");
    }
    User.findOne({ email: email }).then(user => {
      if (!user) {
        return reject("No user found with that email address");
      }
      user.progress = newProgress;
      user.save()
        .then(() => resolve("Progress updated successfully"))
        .catch((err) => reject("There was an error updating the progress: " + err));
    }).catch((err) => reject("There was an error finding the user: " + err));
  });
}

// Export the functions
module.exports = {
  initialize: initialize,
  registerUser: registerUser,
  checkUser: checkUser,
  resetPassword: resetPassword,
  fetchProgress: fetchProgress,
  updateProgress: updateProgress
};
