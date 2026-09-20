# Avatar Pack

Choose `avatar.json` in Settings → Import Avatar Pack. All eight resources must be relative paths within the pack folder. PNG/JPG/WEBP/GIF up to 12 MB each. Imported images are copied into AppData; moving the original pack does not break the app. Arbitrary scripts, remote URLs and paths escaping the pack are rejected.

```json
{"name":"My Companion","states":{"idle":"idle.png","working":"working.png","thinking":"thinking.png","happy":"happy.png","warning":"warning.png","error":"error.png","sleepy":"sleepy.png","celebrate":"celebrate.png"}}
```

Built-in Nia is one transparent 2D sprite with eight state-specific Web Animations/CSS treatments and messages. It is not Live2D. Renderer and state selection are separate to allow future Live2D/Spine renderers.

## Asset provenance
`public/assets/nia.png` was generated with the built-in imagegen tool using the user's Nia reference sheet. Prompt: transparent full-body chibi Nia with silver-lavender bob, violet eyes, triangle hair clip, white jacket, black outfit, blue pendant, sitting beside laptop and floating blue cube; warm encouraging expression, refined anime style, no text/scenery, full figure with padding. Original generated file retained in Codex generated_images; project uses its own copy.
