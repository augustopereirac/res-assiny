// Áudio Reverso — gravação, inversão e reprodução de áudio no próprio navegador (sem servidor).
// Grava PCM cru pelo Web Audio (funciona no iPhone e no Android), corta o silêncio das pontas e normaliza o volume.
(function (global) {
  const A = {};
  A.MAX_SEG = 12;
  let ctx = null, tocando = null;

  A.suportado = () => !!(global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (global.AudioContext || global.webkitAudioContext));
  A.ctx = () => {
    if (!ctx) ctx = new (global.AudioContext || global.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  // Começa a gravar. Devolve { parar(): Promise<AudioBuffer|null>, nivel(): 0..1, segundos() }
  A.gravar = async (onAuto) => {
    const c = A.ctx();
    A.parar();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    const src = c.createMediaStreamSource(stream);
    const proc = c.createScriptProcessor(4096, 1, 1);
    const mudo = c.createGain(); mudo.gain.value = 0;
    const partes = []; let nivel = 0, total = 0, fim = false;
    const ini = Date.now();
    proc.onaudioprocess = e => {
      if (fim) return;
      const d = e.inputBuffer.getChannelData(0);
      partes.push(new Float32Array(d)); total += d.length;
      let m = 0; for (let i = 0; i < d.length; i += 8) { const v = Math.abs(d[i]); if (v > m) m = v; }
      nivel = nivel * 0.6 + m * 0.4;
      if (total / c.sampleRate >= A.MAX_SEG && onAuto) { const f = onAuto; onAuto = null; setTimeout(f, 0); }
    };
    src.connect(proc); proc.connect(mudo); mudo.connect(c.destination);
    const parar = async () => {
      if (fim) return null; fim = true;
      try { src.disconnect(); proc.disconnect(); mudo.disconnect(); } catch (e) {}
      stream.getTracks().forEach(t => t.stop());
      if (!total) return null;
      const dados = new Float32Array(total); let o = 0;
      partes.forEach(p => { dados.set(p, o); o += p.length; });
      return montar(aparar(dados, c.sampleRate), c.sampleRate);
    };
    return { parar, nivel: () => Math.min(1, nivel * 2.5), segundos: () => (Date.now() - ini) / 1000 };
  };

  // tira o silêncio do começo e do fim (deixa uma folguinha) e normaliza o volume
  function aparar(d, sr) {
    const jan = Math.floor(sr * 0.02);
    let pico = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pico) pico = v; }
    if (pico < 0.003) return d;
    const lim = Math.max(0.01, pico * 0.08);
    const rms = (s) => { let t = 0, n = 0; for (let i = s; i < Math.min(d.length, s + jan); i++) { t += d[i] * d[i]; n++; } return n ? Math.sqrt(t / n) : 0; };
    let a = 0; while (a < d.length && rms(a) < lim) a += jan;
    let b = d.length; while (b > a && rms(Math.max(a, b - jan)) < lim) b -= jan;
    const folga = Math.floor(sr * 0.12);
    a = Math.max(0, a - folga); b = Math.min(d.length, b + folga);
    if (b - a < sr * 0.2) { a = 0; b = d.length; }
    const out = d.slice(a, b);
    const g = Math.min(8, 0.9 / pico);
    for (let i = 0; i < out.length; i++) out[i] *= g;
    // fade de 10 ms nas pontas para não estalar
    const f = Math.min(Math.floor(sr * 0.01), out.length >> 1);
    for (let i = 0; i < f; i++) { const k = i / f; out[i] *= k; out[out.length - 1 - i] *= k; }
    return out;
  }
  function montar(dados, sr) {
    const buf = A.ctx().createBuffer(1, dados.length, sr);
    buf.getChannelData(0).set(dados);
    return buf;
  }

  A.inverter = buf => {
    if (!buf) return null;
    const d = buf.getChannelData(0), r = new Float32Array(d.length);
    for (let i = 0, n = d.length; i < n; i++) r[i] = d[n - 1 - i];
    return montar(r, buf.sampleRate);
  };
  A.duracao = buf => buf ? buf.duration : 0;

  // toca um buffer; onFim é chamado quando acaba (ou quando outro áudio começa)
  A.tocar = (buf, onFim) => {
    A.parar();
    if (!buf) return;
    const c = A.ctx();
    const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination);
    const reg = { s, onFim };
    s.onended = () => { if (tocando === reg) { tocando = null; if (onFim) onFim(); } };
    tocando = reg; s.start();
  };
  A.parar = () => {
    const t = tocando; tocando = null;
    if (t) { try { t.s.stop(); } catch (e) {} if (t.onFim) t.onFim(); }
  };
  A.tocandoAgora = () => !!tocando;

  global.Reverso = global.Reverso || {};
  global.Reverso.Audio = A;
})(window);
