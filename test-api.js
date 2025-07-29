const http = require('http');

// Test health endpoint
function testHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Health check:', result);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
  });
}

// Test training plan data endpoints
function testTrainingPlanEndpoints() {
  return new Promise((resolve, reject) => {
    const testData = {
      name: 'Test Training Plan',
      description: 'A test plan for API testing',
      durationWeeks: 4,
      difficulty: 'intermediate',
      goal: 'Build strength and endurance',
      weeks: [
        {
          weekNumber: 1,
          name: 'Week 1',
          days: [
            {
              dayNumber: 1,
              name: 'Monday',
              exercises: [
                { name: 'Push-ups', sets: 3, reps: 10 },
                { name: 'Squats', sets: 3, reps: 12 }
              ]
            },
            {
              dayNumber: 2,
              name: 'Tuesday',
              exercises: [
                { name: 'Pull-ups', sets: 3, reps: 8 },
                { name: 'Lunges', sets: 3, reps: 10 }
              ]
            }
          ]
        },
        {
          weekNumber: 2,
          name: 'Week 2',
          days: [
            {
              dayNumber: 1,
              name: 'Monday',
              exercises: [
                { name: 'Bench Press', sets: 4, reps: 8 },
                { name: 'Deadlift', sets: 4, reps: 6 }
              ]
            }
          ]
        }
      ]
    };

    const postData = JSON.stringify(testData);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/workout-data/test-user',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ POST training plan data:', result);

          // Now test GET
          const getReq = http.get('http://localhost:3000/api/workout-data/test-user', (getRes) => {
            let getData = '';
            getRes.on('data', chunk => getData += chunk);
            getRes.on('end', () => {
              try {
                const getResult = JSON.parse(getData);
                console.log('✅ GET training plan data:', getResult);

                // Verify the structure
                if (getResult.name === testData.name &&
                    getResult.weeks.length === testData.weeks.length &&
                    getResult.weeks[0].days.length === testData.weeks[0].days.length) {
                  console.log('✅ Training plan structure verified');
                  resolve({ post: result, get: getResult });
                } else {
                  reject(new Error('Training plan structure mismatch'));
                }
              } catch (e) {
                reject(e);
              }
            });
          });
          getReq.on('error', reject);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test user profile endpoints
function testUserProfileEndpoints() {
  return new Promise((resolve, reject) => {
    const testUserId = 'test-profile-user';
    const testProfile = {
      userId: testUserId,
      bodyweight: 75 // within valid range
    };

    const postData = JSON.stringify(testProfile);

    // Test POST (create profile)
    const postOptions = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/user-profile/${testUserId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const postReq = http.request(postOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ POST user profile:', result);

          // Test GET (retrieve profile)
          const getReq = http.get(`http://localhost:3000/api/user-profile/${testUserId}`, (getRes) => {
            let getData = '';
            getRes.on('data', chunk => getData += chunk);
            getRes.on('end', () => {
              try {
                const getResult = JSON.parse(getData);
                console.log('✅ GET user profile:', getResult);

                // Verify the profile
                if (getResult.userId === testUserId &&
                    getResult.bodyweight === testProfile.bodyweight) {
                  console.log('✅ User profile verified');

                  // Test DELETE (delete profile)
                  const deleteReq = http.request({
                    hostname: 'localhost',
                    port: 3000,
                    path: `/api/user-profile/${testUserId}`,
                    method: 'DELETE'
                  }, (deleteRes) => {
                    let deleteData = '';
                    deleteRes.on('data', chunk => deleteData += chunk);
                    deleteRes.on('end', () => {
                      try {
                        const deleteResult = JSON.parse(deleteData);
                        console.log('✅ DELETE user profile:', deleteResult);

                        // Verify deletion by trying to GET again
                        const verifyDeleteReq = http.get(`http://localhost:3000/api/user-profile/${testUserId}`, (verifyDeleteRes) => {
                          let verifyDeleteData = '';
                          verifyDeleteRes.on('data', chunk => verifyDeleteData += chunk);
                          verifyDeleteRes.on('end', () => {
                            try {
                              const verifyDeleteResult = JSON.parse(verifyDeleteData);
                              reject(new Error('Profile should have been deleted but was found'));
                            } catch (e) {
                              if (e.message.includes('ENOENT') || verifyDeleteRes.statusCode === 404) {
                                console.log('✅ Profile deletion verified');
                                resolve({ post: result, get: getResult, delete: deleteResult });
                              } else {
                                reject(e);
                              }
                            }
                          });
                        });
                        verifyDeleteReq.on('error', reject);
                      } catch (e) {
                        reject(e);
                      }
                    });
                  });
                  deleteReq.on('error', reject);
                  deleteReq.end();
                } else {
                  reject(new Error('User profile data mismatch'));
                }
              } catch (e) {
                reject(e);
              }
            });
          });
          getReq.on('error', reject);
        } catch (e) {
          reject(e);
        }
      });
    });

    postReq.on('error', reject);
    postReq.write(postData);
    postReq.end();
  });
}

// Run tests
async function runTests() {
  console.log('🧪 Testing GRND Backend API...');
  try {
    await testHealth();
    await testTrainingPlanEndpoints();
    await testUserProfileEndpoints();
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Only run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { testHealth, testTrainingPlanEndpoints, runTests };