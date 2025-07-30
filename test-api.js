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

// Test training plan data endpoints with new PRD-compliant structure
function testTrainingPlanEndpoints() {
  return new Promise((resolve, reject) => {
    const testData = {
      id: 'test-plan-123',
      name: 'Test Training Plan',
      start_date: new Date().toISOString(),
      weeks: [
        {
          week_number: 1,
          days: [
            {
              id: 'day-1',
              name: 'Monday',
              day_type: 'STANDARD',
              exercises: [
                {
                  id: 'exercise-1',
                  name: 'Push-ups',
                  exercise_type: 'BODYWEIGHT',
                  bodyweight_load_percentage: 0.75,
                  target_sets: 3,
                  target_reps: 10,
                  completed_sets: [
                    { reps: 10 },
                    { reps: 8 },
                    { reps: 7 }
                  ]
                },
                {
                  id: 'exercise-2',
                  name: 'Squats',
                  exercise_type: 'BODYWEIGHT',
                  bodyweight_load_percentage: 0.85,
                  target_sets: 3,
                  target_reps: 12,
                  completed_sets: [
                    { reps: 12 },
                    { reps: 10 },
                    { reps: 10 }
                  ]
                }
              ]
            },
            {
              id: 'day-2',
              name: 'Tuesday',
              day_type: 'STANDARD',
              exercises: [
                {
                  id: 'exercise-3',
                  name: 'Pull-ups',
                  exercise_type: 'BODYWEIGHT',
                  bodyweight_load_percentage: 1.0,
                  target_sets: 3,
                  target_reps: 8,
                  completed_sets: [
                    { reps: 8 },
                    { reps: 6 },
                    { reps: 5 }
                  ]
                },
                {
                  id: 'exercise-4',
                  name: 'Lunges',
                  exercise_type: 'BODYWEIGHT',
                  bodyweight_load_percentage: 0.7,
                  target_sets: 3,
                  target_reps: 10,
                  completed_sets: [
                    { reps: 10 },
                    { reps: 8 },
                    { reps: 8 }
                  ]
                }
              ]
            }
          ]
        },
        {
          week_number: 2,
          days: [
            {
              id: 'day-3',
              name: 'Monday',
              day_type: 'STANDARD',
              exercises: [
                {
                  id: 'exercise-5',
                  name: 'Bench Press',
                  exercise_type: 'WEIGHTED',
                  target_sets: 4,
                  target_reps: 8,
                  completed_sets: [
                    { reps: 8, weight: 60 },
                    { reps: 6, weight: 60 },
                    { reps: 6, weight: 60 },
                    { reps: 5, weight: 60 }
                  ]
                },
                {
                  id: 'exercise-6',
                  name: 'Deadlift',
                  exercise_type: 'WEIGHTED',
                  target_sets: 4,
                  target_reps: 6,
                  completed_sets: [
                    { reps: 6, weight: 80 },
                    { reps: 5, weight: 80 },
                    { reps: 5, weight: 80 },
                    { reps: 4, weight: 80 }
                  ]
                }
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
                if (getResult.id === testData.id &&
                    getResult.name === testData.name &&
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

// Test volume calculation endpoint
function testVolumeCalculation() {
  return new Promise((resolve, reject) => {
    const testData = {
      user_bodyweight: 75, // 75kg user
      exercises: [
        {
          id: 'exercise-1',
          name: 'Push-ups',
          exercise_type: 'BODYWEIGHT',
          bodyweight_load_percentage: 0.75,
          completed_sets: [
            { reps: 10 },
            { reps: 8 },
            { reps: 7 }
          ]
        },
        {
          id: 'exercise-2',
          name: 'Bench Press',
          exercise_type: 'WEIGHTED',
          completed_sets: [
            { reps: 8, weight: 60 },
            { reps: 6, weight: 60 },
            { reps: 6, weight: 60 },
            { reps: 5, weight: 60 }
          ]
        }
      ]
    };

    const postData = JSON.stringify(testData);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/calculate-volume',
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
          console.log('✅ Volume calculation result:', result);

          // Calculate expected volume manually
          // Push-ups: 75kg * 0.75 * (10 + 8 + 7) = 1762.5kg
          // Bench Press: (8 + 6 + 6 + 5) * 60kg = 1440kg
          // Total: 1762.5 + 1440 = 3202.5kg
          const expectedVolume = 1762.5 + 1440;

          if (result.total_volume_kg >= expectedVolume - 0.1 && result.total_volume_kg <= expectedVolume + 0.1) {
            console.log('✅ Volume calculation verified');
            resolve(result);
          } else {
            reject(new Error(`Volume calculation incorrect: expected ${expectedVolume}, got ${result.total_volume_kg}`));
          }
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

// Run tests
async function runTests() {
  console.log('🧪 Testing GRND Backend API...');
  try {
    await testHealth();
    await testTrainingPlanEndpoints();
    await testUserProfileEndpoints();
    await testVolumeCalculation();
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Only run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { testHealth, testTrainingPlanEndpoints, testVolumeCalculation, runTests };