/**
 * Intro cinematográfico: "ya visto" se recuerda 7 días en localStorage.
 * Compartido entre el IntroGate (cliente) y el script inline temprano del
 * layout raíz, que marca <html data-intro-visto> antes del primer paint para
 * que el overlay no destelle a quien ya lo vio.
 */
export const CLAVE_INTRO_VISTO = "circle-intro-visto";
export const VIGENCIA_INTRO_MS = 7 * 24 * 60 * 60 * 1000;

/** Script inline (síncrono, en <head>). try/catch: localStorage puede estar bloqueado. */
export const SCRIPT_INTRO_VISTO = `try{var t=Number(localStorage.getItem(${JSON.stringify(
  CLAVE_INTRO_VISTO,
)}));if(t>0&&Date.now()-t<${VIGENCIA_INTRO_MS})document.documentElement.setAttribute("data-intro-visto","")}catch(e){}`;
