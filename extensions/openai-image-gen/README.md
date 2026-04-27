# OpenAI Image Generation

Pi extension that registers the `openai_generate_image` tool for generating images with OpenAI GPT Image models.

## Backends

- **ChatGPT subscription**: uses the `openai-codex` login created via `/login`.
- **OpenAI Platform API**: uses the `openai` API key from `OPENAI_API_KEY` or pi auth configuration.

By default `backend=auto` prefers the ChatGPT subscription backend when available, then falls back to the API backend.

## Usage

Ask pi to generate an image, or call the tool explicitly:

```text
Generate an image of a retro robot barista
Use openai_generate_image with backend api to generate a red square on white
```

Useful options:

- `backend`: `auto`, `subscription`, or `api`
- `size`: `auto`, `1024x1024`, `1024x1536`, or `1536x1024`
- `quality`: `auto`, `low`, `medium`, or `high`
- `outputFormat`: `png`, `jpeg`, or `webp`
- `save`: `none`, `project`, `global`, or `custom`

## Saving Images

Default behavior returns the image inline without writing to disk.

Save modes:

- `project`: `<repo>/.pi/generated-images/`
- `global`: `~/.pi/agent/generated-images/`
- `custom`: `saveDir` parameter or `PI_IMAGE_SAVE_DIR`

Defaults can be configured via environment variables:

```bash
export PI_IMAGE_SAVE_MODE=project
export PI_IMAGE_SAVE_DIR=/path/to/images
```

Or with JSON config, where project config overrides global config:

```text
~/.pi/agent/extensions/openai-image-gen.json
<repo>/.pi/extensions/openai-image-gen.json
```

Example config:

```json
{
  "backend": "auto",
  "save": "project"
}
```

## Status Command

Use `/openai-image-status` to check whether subscription and API credentials are available.
