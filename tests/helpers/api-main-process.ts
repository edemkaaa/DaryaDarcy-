// Launch the real executable with the parent's explicitly isolated environment.
import "../../apps/backend/src/_core/index";
const ready = setInterval(async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${process.env.PORT}/api/health`);
    if (res.status === 200) {
      clearInterval(ready);
      process.send?.({ ready: true });
    }
  } catch { /* Startup is bounded by the parent process test. */ }
}, 50);
