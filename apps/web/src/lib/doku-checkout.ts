/**
 * Pop-up DOKU Checkout (CLAUDE.md: DOKU Checkout mode pop-up). URL script datang dari API
 * sesuai DOKU_ENV; frontend tidak menentukan sandbox/production sendiri.
 */
declare global {
  interface Window {
    loadJokulCheckout?: (paymentUrl: string) => void;
  }
}

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let promise = loaded.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loaded.delete(src);
        script.remove();
        reject(new Error('Script DOKU gagal dimuat'));
      };
      document.head.appendChild(script);
    });
    loaded.set(src, promise);
  }
  return promise;
}

/**
 * Buka halaman bayar DOKU sebagai pop-up. Bila script gagal dimuat, pembeli diarahkan ke
 * halaman bayar DOKU agar tetap bisa membayar (fallback). Status bayar tetap dari server.
 */
export async function openDokuCheckout(
  paymentUrl: string,
  scriptUrl: string,
): Promise<'popup' | 'redirect'> {
  try {
    await loadScript(scriptUrl);
    if (typeof window.loadJokulCheckout !== 'function')
      throw new Error('loadJokulCheckout tidak ada');
    window.loadJokulCheckout(paymentUrl);
    return 'popup';
  } catch {
    window.location.assign(paymentUrl);
    return 'redirect';
  }
}
