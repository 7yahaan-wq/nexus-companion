# Avatar Pack

Choose `avatar.json` in Settings → Import Avatar Pack. All eight resources must be relative paths within the pack folder. PNG/JPG/WEBP/GIF up to 12 MB each. Imported images are copied into AppData; moving the original pack does not break the app. Arbitrary scripts, remote URLs and paths escaping the pack are rejected.

```json
{
  "name": "My Companion",
  "states": {
    "idle": "idle.png",
    "working": "working.png",
    "thinking": "thinking.png",
    "happy": "happy.png",
    "warning": "warning.png",
    "error": "error.png",
    "sleepy": "sleepy.png",
    "celebrate": "celebrate.png"
  }
}
```

Built-in Nia uses a transparent 16-frame atlas: four drawn action rows (idle/blink, typing, thinking, sleepy) express eight semantic states through frame sequences, timings, badges and messages. Settings provides previews and a persisted animation toggle; reduced motion and hidden/minimized windows pause playback. Imported packs retain the eight-image format; the toggle does not freeze animation embedded inside imported GIFs. It is not Live2D. See [Nia animation and provenance](NIA_ANIMATION.md) for assets, state mapping and extension points.

## Asset provenance

`public/assets/nia.png` was generated with the built-in imagegen tool using the user's Nia reference sheet. Prompt: transparent full-body chibi Nia with silver-lavender bob, violet eyes, triangle hair clip, white jacket, black outfit, blue pendant, sitting beside laptop and floating blue cube; warm encouraging expression, refined anime style, no text/scenery, full figure with padding. Original generated file retained in Codex generated_images; project uses its own copy.
