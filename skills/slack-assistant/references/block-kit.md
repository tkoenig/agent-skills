# Block Kit quick reference

Use Block Kit for structured messages that benefit from a layout. Prefer ordinary Slack markup for everyday messages. This is a practical reference, not a copy of the full specification.

Researched against official Slack docs on **2026-09-10**, with SlackCLI **0.11.0**. Advanced layouts below are documentation-verified, not live-tested with our browser-session credentials. CLI acceptance of JSON does not guarantee Slack will accept a block for this identity or surface.

## SlackCLI limits

- `messages draft` accepts Slack markup and converts it to rich text; it does **not** accept custom Block Kit JSON.
- Approved sends accept `--blocks='JSON'` or `--blocks=@/absolute/path.json`.
- `--blocks` and `--file` cannot be combined in SlackCLI. Use a normally formatted message when attaching a screenshot.
- Include a meaningful `--message` summary with blocks for notifications and screen readers. Put essential information in this fallback, not just “see above.”
- Always follow the skill's preview and explicit approval workflow. Block Kit does not change sending permissions.

## Common blocks

| Block | Purpose | Text format |
| --- | --- | --- |
| `header` | Short heading | `plain_text` |
| `section` | Main text; optional compact `fields` | `mrkdwn` or `plain_text` |
| `context` | Small supporting text | Array of text/image elements |
| `divider` | Visual separator | No text |

Text objects look like `{"type":"mrkdwn","text":"*Hello*"}`. Use `plain_text` when markup should not be interpreted. Headers do not support `mrkdwn`.

Slack `mrkdwn` is not standard Markdown:

- Bold: `*text*`; italic: `_text_`; strike: `~text~`.
- Inline code: backticks; code blocks: triple backticks.
- Link: `<https://example.com|label>`, not `[label](url)`.
- Lists: use `•` and newlines; Markdown headings are not supported in `mrkdwn`.
- In literal text, escape `&`, `<`, and `>` as `&amp;`, `&lt;`, and `&gt;`. Keep intentional Slack link/mention syntax intact. JSON escaping is separate: use a JSON serializer for dynamic text.

## Example: concise status message

Save the following JSON array in a message-content file such as `/absolute/path/status-blocks.json`. Do not wrap it in a `{"blocks": ...}` object for SlackCLI.

```json
[
  {
    "type": "header",
    "text": {"type": "plain_text", "text": "Slack assistant update"}
  },
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "*Ready for review*\n• Workspace follows the project directory.\n• Messages start as drafts.\n• Sending requires explicit approval."
    }
  },
  {"type": "divider"},
  {
    "type": "context",
    "elements": [
      {"type": "mrkdwn", "text": "Built with <https://github.com/shaharia-lab/slackcli|SlackCLI>."}
    ]
  }
]
```

After showing the content and destination to the user and receiving approval, invoke the skill wrapper by absolute path without changing the calling directory:

```bash
{baseDir}/scripts/slack-assistant send-approved \
  --recipient-id=C123 \
  --message='Slack assistant update: workspace follows the project directory, messages start as drafts, and sending requires explicit approval. Built with SlackCLI.' \
  --blocks=@/absolute/path/status-blocks.json \
  --json
```

`{baseDir}` is the **skill root**, not this references directory. This example sends a new message; it does not create or update a draft.

## Advanced message layouts

### Standard Markdown versus Slack markup

The newer [`markdown` block](https://docs.slack.dev/reference/block-kit/blocks/markdown-block/) accepts **standard Markdown**, unlike a `section` text object's `mrkdwn`. It supports headings, ordered/nested formatting, task lists, tables and fenced code with syntax highlighting. Markdown image syntax becomes a link, not an embedded image. Heading levels render at the same size.

```json
[
  {
    "type": "markdown",
    "text": "## Release review\n- [x] Tests pass\n- [ ] Human approval\n\n[Review details](https://example.com/review)"
  }
]
```

The docs describe this block for apps using platform AI features; do not assume availability with our browser-session identity. Slack translates it into one or more blocks and ignores its `block_id`. Prefer `section` + `mrkdwn` when advanced Markdown is unnecessary. Task-list rendering alone does not implement an approval workflow.

### Structured rich text

[`rich_text`](https://docs.slack.dev/reference/block-kit/blocks/rich-text-block/) is the structured format emitted by Slack's message composer. Use it when explicit lists, quotes or text styles are easier to build as JSON than as markup.

- `rich_text_section`: inline elements such as text, links and mentions.
- `rich_text_list`: bullet or ordered lists, including nested structures.
- `rich_text_quote`: quoted content.
- `rich_text_preformatted`: code/preformatted content.

For example, a block with a bold label and a real bullet list:

```json
[
  {
    "type": "rich_text",
    "elements": [
      {
        "type": "rich_text_section",
        "elements": [{"type": "text", "text": "Review checklist", "style": {"bold": true}}]
      },
      {
        "type": "rich_text_list",
        "style": "bullet",
        "elements": [
          {"type": "rich_text_section", "elements": [{"type": "text", "text": "Confirm recipient"}]},
          {"type": "rich_text_section", "elements": [{"type": "text", "text": "Review attachments"}]}
        ]
      }
    ]
  }
]
```

This does not unlock custom draft payloads: SlackCLI still constructs draft rich text itself from `--message`.

### Fields, tables and hierarchy

- [`section.fields`](https://docs.slack.dev/reference/block-kit/blocks/section-block/) provides a compact two-column layout for label/value pairs. It is not a general-purpose table. An `accessory` can add one compatible image or control; check the element's supported surfaces.
- [`table`](https://docs.slack.dev/reference/block-kit/blocks/table-block/) provides rows of `raw_text`, `raw_number` or `rich_text` cells. `column_settings` controls `align` (`left`, `center`, `right`) and `is_wrapped`. Prefer small tables that remain readable on mobile.
- [`header.level`](https://docs.slack.dev/reference/block-kit/blocks/header-block/) supports levels 1–4. Header text remains `plain_text`.
- [`section.expand`](https://docs.slack.dev/reference/block-kit/blocks/section-block/) controls whether text is always expanded; Slack describes its long-message use for AI Assistant apps. It does not increase the text limit.

A small table block, passed inside the usual blocks array:

```json
[
  {
    "type": "table",
    "column_settings": [{"is_wrapped": true}, {"align": "left"}],
    "rows": [
      [{"type": "raw_text", "text": "Check"}, {"type": "raw_text", "text": "Status"}],
      [{"type": "raw_text", "text": "Tests"}, {"type": "raw_text", "text": "Passing"}],
      [{"type": "raw_text", "text": "Approval"}, {"type": "raw_text", "text": "Pending"}]
    ]
  }
]
```

### Images, files and video

| Feature | How it works | Boundary for this skill |
| --- | --- | --- |
| [Image block](https://docs.slack.dev/reference/block-kit/blocks/image-block/) | `alt_text` plus a public `image_url` or `slack_file`; optional plain-text title. | A local filesystem path is not an image URL. Never publish a private screenshot to a public host just to embed it. |
| [Slack image file object](https://docs.slack.dev/reference/block-kit/composition-objects/slack-file-object/) | `slack_file: {"id":"F123"}` or a Slack file URL, not both. Posting identity must have file access. PNG/JPG/JPEG/GIF supported. | An already-uploaded, accessible Slack image can be referenced within blocks. That is distinct from combining `--blocks` and a new `--file` upload, which SlackCLI rejects. Confirm the file and intended audience before sharing. |
| [File block](https://docs.slack.dev/reference/block-kit/blocks/file-block/) | Appears in retrieved messages containing remote files. | Cannot be added directly to app surfaces; it is not a way to attach a local file. Use approved `--file` sending instead. |
| [Video block](https://docs.slack.dev/reference/block-kit/blocks/video-block/) | Embeds a video using title, thumbnail, accessibility text and an HTTPS iframe-compatible URL. | App-only: requires `links.embed:write` and configured unfurl domains. Do not assume browser-session sending can use it; ordinary links are simpler. |

## Interactive features: require an app, not just a message

Our wrapper sends content; it does not host interaction handlers, open modals or publish App Home views. Adding interactive JSON does not implement the behavior behind it.

- [`actions`](https://docs.slack.dev/reference/block-kit/blocks/actions-block/) groups buttons, select/overflow menus and date pickers. [`section.accessory`](https://docs.slack.dev/reference/block-kit/blocks/section-block/) can place a compatible control beside text.
- [`button`](https://docs.slack.dev/reference/block-kit/block-elements/button-element/) supports `primary`/`danger` styles, `value`, `action_id`, `accessibility_label` and a confirmation dialog. **Even URL buttons normally send an interaction payload that needs acknowledgment.** Use a regular text link for a no-handler message.
- The button's newer `agent_prompt` hands a prompt to Slackbot when the clicking user has Slackbot AI. Otherwise it falls back to the normal interaction payload, so an app handler is still needed for reliable behavior.
- [Select menus](https://docs.slack.dev/reference/block-kit/block-elements/select-menu-element/) can use static or dynamically loaded options. External options require an app endpoint; a dropdown does not automatically execute the user's choice.
- [`input`](https://docs.slack.dev/reference/block-kit/blocks/input-block/) collects values in [modals](https://docs.slack.dev/surfaces/modals/) or [App Home](https://docs.slack.dev/surfaces/app-home/). It is not an ordinary chat-message form.
- [Interaction handling](https://docs.slack.dev/interactivity/handling-user-interaction/) requires an app configured to receive payloads and acknowledge valid requests within **3 seconds**. Long-running work happens after acknowledgment. An app's confirmation dialog is not a substitute for the user's approval to send a message from this agent.

Do not add buttons that imply working approvals, submissions or other actions unless that app behavior actually exists.

## Useful limits

Snapshot from the linked official references; recheck when a payload approaches a limit or Slack rejects it.

| Item | Limit | Source |
| --- | --- | --- |
| Blocks per surface | 50 per message; 100 per modal/Home tab | [Blocks overview](https://docs.slack.dev/reference/block-kit/blocks/) |
| Header text | 150 characters | [Header](https://docs.slack.dev/reference/block-kit/blocks/header-block/) |
| Section text / fields | 3,000 characters; up to 10 fields of 2,000 characters each | [Section](https://docs.slack.dev/reference/block-kit/blocks/section-block/) |
| Context elements | 10 | [Context](https://docs.slack.dev/reference/block-kit/blocks/context-block/) |
| Actions elements | 25 | [Actions](https://docs.slack.dev/reference/block-kit/blocks/actions-block/) |
| Markdown block text | 12,000 characters cumulatively across all markdown blocks in a payload | [Markdown](https://docs.slack.dev/reference/block-kit/blocks/markdown-block/) |
| Table | 100 rows; 20 cells per row; 10,000 characters across table cells per message | [Table](https://docs.slack.dev/reference/block-kit/blocks/table-block/) |
| Button label | 75 characters; may truncate around 30 | [Button](https://docs.slack.dev/reference/block-kit/block-elements/button-element/) |
| Image alt text | 2,000 characters; must be plain text | [Image](https://docs.slack.dev/reference/block-kit/blocks/image-block/) |

For blocks supporting `block_id`, keep it unique within the message/view and generate a new ID for each updated iteration (maximum 255 characters). `markdown` ignores it. Interactive `action_id` values identify controls within their containing block; do not confuse them with block IDs.

## Validation and further reference

- Validate JSON before sending; use the [Block Kit Builder](https://app.slack.com/block-kit-builder) for visual previews. Do not paste sensitive workspace content into external tools without approval.
- Check the [block catalog](https://docs.slack.dev/reference/block-kit/blocks/) for each block's supported surfaces; messages, modals and App Home are not interchangeable.
- Check the [element catalog](https://docs.slack.dev/reference/block-kit/block-elements/) for compatible containers and the [composition objects](https://docs.slack.dev/reference/block-kit/composition-objects/) for text, options and confirmation schemas.
- SlackCLI validates the blocks array shape, not every Slack schema or permission rule. Treat a server rejection as a failure; do not silently switch format, send a second message or remove an attachment without approval.
