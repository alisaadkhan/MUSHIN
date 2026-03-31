async function poll() {
  try {
    const res = await fetch('https://mushin-syq3.vercel.app/auth');
    console.log(`Polling /auth: Status ${res.status}`);
    if (res.status === 200) {
      console.log('Deployment successful: 200 OK');
      process.exit(0);
    }
  } catch (e) {
    console.error(e.message);
  }
  setTimeout(poll, 15000);
}

console.log('Starting polling...');
poll();
