---
name: fluxiom
description: "Interact with the Fluxiom digital asset management API. Use for uploading, searching, organizing, tagging, and sharing files via the Fluxiom REST API."
---

# Fluxiom

Interact with the Fluxiom digital asset management API using `curl`.

## Configuration

Config file: `~/.config/fluxiom/config.json`

```json
{
  "subdomain": "acme",
  "domain": "fluxiom.com",
  "user": "jane@acme.example.com",
  "password": "your-password"
}
```

All requests use HTTP Basic Auth over HTTPS. Read credentials from the config file:

```bash
FLUXIOM_SUBDOMAIN=$(jq -r .subdomain ~/.config/fluxiom/config.json)
FLUXIOM_DOMAIN=$(jq -r '.domain // "fluxiom.com"' ~/.config/fluxiom/config.json)
FLUXIOM_USER=$(jq -r .user ~/.config/fluxiom/config.json)
FLUXIOM_PASS=$(jq -r .password ~/.config/fluxiom/config.json)
```

## Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/account | Get account info |
| GET | /api/assets | List/search assets |
| GET | /api/assets/ID | Get single asset |
| GET | /api/assets/download/ID | Download asset |
| POST | /api/assets | Create asset (upload) |
| PUT | /api/assets/ID | Update asset |
| DELETE | /api/assets/ID | Delete asset |
| GET | /api/assets/ID/versions | List asset versions |
| GET | /api/assets/ID/versions/VID | Get single version |
| POST | /api/assets/ID/versions | Create new version |
| GET | /api/tags | List tags |
| GET | /api/tags/ID | Get single tag |
| POST | /api/tags | Create tag |
| PUT | /api/tags/ID | Update tag |
| DELETE | /api/tags/ID | Delete tag |
| GET | /api/users | List users |
| GET | /api/users/ID | Get single user |
| GET | /api/user | Get current user |

## Account

### Get Account Info

```bash
# Read credentials (do this once per session)
FLUXIOM_SUBDOMAIN=$(jq -r .subdomain ~/.config/fluxiom/config.json)
FLUXIOM_DOMAIN=$(jq -r '.domain // "fluxiom.com"' ~/.config/fluxiom/config.json)
FLUXIOM_USER=$(jq -r .user ~/.config/fluxiom/config.json)
FLUXIOM_PASS=$(jq -r .password ~/.config/fluxiom/config.json)

curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/account.json"
```

Response:
```json
{
  "subdomain": "acme",
  "plan": "Basic",
  "stats": { "used_space": "8456140", "available_space": "30056314932" },
  "country": "AT",
  "trial": "false",
  "account_holder_id": "1",
  "branding": "active",
  "branding_info": { "title": "Acme", "logo": "/branding/logo.png" },
  "billing_email": "billing@acme.example.com",
  "created_on": "2009-08-19T22:00:00Z",
  "updated_on": "2009-08-19T22:00:00Z"
}
```

## Assets

### List / Search Assets

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets.json?query=logo&tags=design&page=1&per_page=25"
```

Parameters: `query` (search term), `tags` (comma-separated names or IDs), `page`, `per_page` (max 100).

Response:
```json
[
  {
    "id": 18552,
    "title": "fluxiom logo",
    "filename": "logo.gif",
    "description": "The fluxiom logo",
    "thumb_url": "/t/.../ebc62ck6w8p7c5nodq9_64.jpg"
  }
]
```

### Get Single Asset

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets/ID.json"
```

Response includes full metadata: `size`, `content_type`, `created_on`, `updated_on`, `version`, `user_id`, `tags` array, and image metadata fields (`metadata_pixel_width`, `metadata_pixel_height`, `metadata_color_space`, etc.).

### Download Asset

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  -o output.jpg \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets/download/ID.json"
```

### Upload a File

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  -F "file=@/path/to/file.png" \
  -F "title=My File" \
  -F "description=File description" \
  -F "tags=design,branding" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets.json"
```

Parameters: `file` (required, postdata), `title`, `description`, `tags` (comma-separated).

### Update Asset

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  -X PUT \
  -d "title=Updated Title" \
  -d "description=New description" \
  -d "tags=new-tag,other-tag" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets/ID.json"
```

Parameters: `title`, `description`, `tags` (comma-separated).

### Delete Asset

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  -X DELETE \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets/ID.json"
```

### Asset Versions

List versions:
```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets/ID/versions.json"
```

Get single version:
```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets/ID/versions/VID.json"
```

Create new version:
```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  -F "file=@/path/to/updated-file.png" \
  -F "comment=Updated logo with new colors" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/assets/ID/versions.json"
```

Version response includes: `id`, `version`, `comment`, `size`, `content_type`, `filename`, `user_id`, `created_on`, `updated_on`, and `metadata` object.

## Tags

### List Tags

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/tags.json"
```

Response:
```json
[
  { "tag": "fluxiom", "id": 13409, "documents_count": 20, "stages_count": 1 }
]
```

### Create Tag

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  -X POST -d "tag=my-new-tag" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/tags.json"
```

### Update Tag

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  -X PUT -d "tag=renamed-tag" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/tags/ID.json"
```

### Delete Tag

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  -X DELETE \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/tags/ID.json"
```

## Users

### List Users

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/users.json"
```

Response:
```json
[
  {
    "id": 22,
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@acme.example.com",
    "permissions": ["login", "manage_assets"],
    "created_on": "2009-03-24T09:05:02+01:00",
    "updated_on": "2010-07-15T16:52:18+02:00"
  }
]
```

### Get Current User

```bash
curl -s -u "$FLUXIOM_USER:$FLUXIOM_PASS" \
  "https://$FLUXIOM_SUBDOMAIN.$FLUXIOM_DOMAIN/api/user.json"
```
