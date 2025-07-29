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

// Test workout data endpoints
function testWorkoutEndpoints() {
  return new Promise((resolve, reject) => {
    const testData = {
      workouts: [
        {
          id: 'test-1',
          name: 'Test Workout',
          exercises: [
            { name: 'Push-ups', sets: 3, reps: 10 }
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
          console.log('✅ POST workout data:', result);
          
          // Now test GET
          const getReq = http.get('http://localhost:3000/api/workout-data/test-user', (getRes) => {
            let getData = '';
            getRes.on('data', chunk => getData += chunk);
            getRes.on('end', () => {
              try {
                const getResult = JSON.parse(getData);
                console.log('✅ GET workout data:', getResult);
                resolve({ post: result, get: getResult });
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

// Run tests
async function runTests() {
  console.log('🧪 Testing GRND Backend API...');
  try {
    await testHealth();
    await testWorkoutEndpoints();
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Only run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { testHealth, testWorkoutEndpoints, runTests };