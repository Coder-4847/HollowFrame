export class Input {
  constructor(canvas, settings = () => ({})) {
    this.settings = settings;
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.fire = false;
    this.aim = false;
    this.shot = false;
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    window.addEventListener('keydown', (e) => {
      if (document.pointerLockElement !== canvas) return;
      if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) {
        this.pressed.add(e.code);
        if (['KeyC', 'ControlLeft'].includes(e.code) && this.settings().toggleCrouch)
          this.crouchToggle = !this.crouchToggle;
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    window.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== canvas) return;
      if (e.button === 0) {
        this.fire = true;
        this.shot = true;
      }
      if (e.button === 2) this.aim = this.settings().toggleAim ? !this.aim : true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2 && !this.settings().toggleAim) this.aim = false;
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (document.pointerLockElement === canvas) {
          e.preventDefault();
          this.wheel = Math.sign(e.deltaY);
        }
      },
      { passive: false },
    );
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.reset());
  }
  down(k) {
    return this.keys.has(k);
  }
  tap(k) {
    return this.pressed.has(k);
  }
  end() {
    this.dx = 0;
    this.dy = 0;
    this.pressed.clear();
    this.shot = false;
    this.wheel = 0;
  }
  reset() {
    this.keys.clear();
    this.fire = false;
    this.aim = false;
    this.crouchToggle = false;
    this.end();
  }
}
