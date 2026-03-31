async function poll() {
  try {
    const resAuth = await fetch('https://mushin-syq3.vercel.app/auth');
    const resApi = await fetch('https://mushin-syq3.vercel.app/_/python-analytics');
    
    console.log(`Polling: /auth (Status ${resAuth.status}), /_/python-analytics (Status ${resApi.status})`);
    
    if (resAuth.status === 200) {
      console.log('Deployment successful: 200 OK for /auth');
      process.exit(0);
    }
  } catch (e) {
    console.error(e.message);
  }
  setTimeout(poll, 15000);
}

console.log('Starting deployment validation pool...');
poll();
