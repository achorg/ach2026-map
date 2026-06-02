# WorkAdventure Self-Hosted — Incident Response Playbook

**Environment:** Single DigitalOcean Ubuntu VM · Docker Compose · Livekit + Coturn co-located  
**Last reviewed:** <!-- fill in date -->  
**On-call contact:** <!-- fill in -->

-----

## Quick Reference

### Service Map

|Container    |Role                           |Public?      |
|-------------|-------------------------------|-------------|
|`traefik`    |Reverse proxy / SSL termination|Yes          |
|`play`       |Frontend + WebSocket pusher    |Yes          |
|`back`       |Backend API / game state       |Internal only|
|`redis`      |Session state / pub-sub        |Internal only|
|`map-storage`|Map file server                |Yes          |
|`uploader`   |Asset uploads                  |Yes          |
|`livekit`    |Audio/video (5+ people)        |Yes          |
|`coturn`     |WebRTC TURN relay              |Yes          |

### Essential Commands

```bash
# The app is installed here
/home/workadventure/apps/workadventure

# Check all container statuses
docker compose ps

# Check logs
docker compose logs -f
# for a specific service
docker compose logs -f play

# Start all services
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d

# Stop all services
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml down

# Restart a single service
docker compose restart <service>

# Restart everything
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml down && docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d

# Check resource usage
docker stats --no-stream

# Check disk space
df -h

# Check VM memory
free -h
```

-----

## Incident Runbooks

-----

### INC-01 · Site Completely Unreachable

**Symptoms:** Browser shows connection refused, timeout, or blank page. No users can connect.

**Detection:**

```bash
curl -I https://<your-domain>
docker compose ps
```

**Triage steps:**

1. Check if Traefik is running:
   
   ```bash
   docker compose ps traefik
   docker compose logs --tail=50 traefik
   ```
1. Check if `play` is running:
   
   ```bash
   docker compose ps play
   docker compose logs --tail=50 play
   ```
1. If either shows `Exited` or `Restarting`:
   
   ```bash
   docker compose restart traefik
   docker compose restart play
   ```
1. If containers are running but site still unreachable, check the VM firewall:
   
   ```bash
   ufw status
   # Ports 80, 443, and 3478 (TURN) should be open
   ```
1. Check DigitalOcean firewall rules in the DO console — ensure ports 80 and 443 are open inbound.
1. If SSL cert has expired (browser shows cert warning):
   
   ```bash
   docker compose logs traefik | grep -i "certificate\|acme\|tls"
   # Force cert renewal by restarting traefik
   docker compose restart traefik
   ```

**Comms template:**

> “We’re aware the conference space is currently unreachable. Our team is investigating and will provide an update in 10 minutes.”

-----

### INC-02 · “Network Error” on Load

**Symptoms:** Page loads but users see a “Network Error” banner. Cannot enter any room.

**Detection:** Users report the error; browser console shows WebSocket connection failures.

**Triage steps:**

1. Restart `play` and `back`:
   
   ```bash
   docker compose restart play back
   # Wait 20 seconds, then test
   ```
1. Check Redis is healthy (play and back both depend on it):
   
   ```bash
   docker compose ps redis
   docker compose logs --tail=30 redis
   docker compose exec redis redis-cli ping
   # Expected response: PONG
   ```
1. If Redis is down:
   
   ```bash
   docker compose restart redis
   # Then restart play and back to re-establish connections
   docker compose restart play back
   ```
1. Check for certificate trust issues (common after VM reboot):
   
   ```bash
   docker compose logs play | grep -i "cert\|ssl\|tls\|https"
   ```

**Comms template:**

> “Some users are experiencing connection errors entering the space. We’re restarting services now — please refresh your browser in 2–3 minutes.”

-----

### INC-03 · Audio / Video Not Working

**Symptoms:** Users can move and chat but cannot hear or see others. Bubble audio is silent. Meeting rooms are silent.

**Detection:** Users report no audio/video. No error on the main screen.

**Note:** With Livekit and Coturn co-located on the same VM, both services share resources. High CPU/memory on the VM will affect both simultaneously.

**Triage steps:**

1. Check Livekit status:
   
   ```bash
   docker compose ps livekit
   docker compose logs --tail=50 livekit
   ```
1. Check Coturn status:
   
   ```bash
   docker compose ps coturn
   docker compose logs --tail=50 coturn
   ```
1. Check VM resource pressure (co-located services make this more likely):
   
   ```bash
   docker stats --no-stream
   free -h
   # If memory is >85% used, this is likely the cause
   ```
1. Restart audio/video services:
   
   ```bash
   docker compose restart livekit coturn
   ```
1. If resources are saturated, identify and restart the heaviest non-critical container first, then retry.
1. Verify TURN port is reachable (Coturn needs UDP 3478):
   
   ```bash
   # From a different machine or your laptop:
   nc -u -z <your-domain> 3478
   ```
1. Check the DO firewall allows UDP 3478 and the port range configured for Coturn (typically 49152–65535 UDP).

**Workaround for attendees while fixing:**

> “Audio/video is temporarily unavailable. Text chat in rooms still works. We’re working on a fix.”

-----

### INC-04 · Map Fails to Load

**Symptoms:** Users enter a room but see a black screen or a loading spinner that never resolves. The map tiles don’t appear.

**Triage steps:**

1. Check `map-storage` container:
   
   ```bash
   docker compose ps map-storage
   docker compose logs --tail=50 map-storage
   ```
1. Test map accessibility directly:
   
   ```bash
   curl -I https://<your-domain>/map-storage/<your-map-file>.json
   # Expect HTTP 200 and CORS headers
   ```
1. Check for CORS headers in the response:
   
   ```bash
   curl -H "Origin: https://<your-domain>" -I https://<your-domain>/map-storage/<your-map>.json
   # Look for: Access-Control-Allow-Origin header
   ```
1. If map-storage is down:
   
   ```bash
   docker compose restart map-storage
   ```
1. Check disk space — map-storage will fail silently if the volume is full:
   
   ```bash
   df -h
   # If /dev/root or the Docker volume is >90%, free space immediately
   docker system prune --volumes  # WARNING: removes unused volumes
   ```

-----

### INC-05 · Embedded Websites Not Loading in Rooms

**Symptoms:** Clicking an object that should open a website either opens it in a new browser tab instead of the in-room panel, or shows a blank panel.

**Note:** This is usually caused by the *target website’s* security headers, not your WorkAdventure server. It cannot always be fixed from your end.

**Triage steps:**

1. Open browser DevTools (F12) → Console tab. Look for errors like:
- `X-Frame-Options: DENY`
- `Content-Security-Policy: frame-ancestors 'none'`
1. If the error is from the embedded site: the third-party site is blocking iFrames. **You cannot fix this server-side.** Options:
- Replace the embedded site with one that allows iFrames
- Open it via the `openTab` scripting method instead (opens in new tab)
1. If the error is from your own hosted content, add these headers to your Traefik or Nginx config:
   
   ```
   X-Frame-Options: ALLOWALL
   Content-Security-Policy: frame-ancestors *
   ```

-----

### INC-06 · High Load / Slow Performance

**Symptoms:** Avatar movement is laggy, rooms take a long time to load, users are randomly disconnected.

**Detection:**

```bash
docker stats --no-stream
# Watch CPU% and MEM% columns

uptime
# Load average — on a 2-core VM, anything >2.0 is a problem
```

**Triage steps:**

1. Identify the heaviest container:
   
   ```bash
   docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
   ```
1. If `back` or `play` is the culprit, check for connection count spikes:
   
   ```bash
   docker compose logs --tail=100 back | grep -i "connection\|error\|warn"
   ```
1. Check total connected users (if admin API is configured):
   
   ```bash
   curl https://<your-domain>/api/status
   ```
1. If the VM itself is under pressure, restart the heaviest non-essential containers first (e.g. `uploader`, `map-storage`).
1. If the VM is out of memory, you may need to hard-restart the full stack:
   
   ```bash
   docker compose down && docker compose up -d
   # Expect ~60 seconds of downtime
   ```
1. **Scaling note:** Livekit and Coturn co-located on the same VM as WorkAdventure will compete for CPU during peak audio/video usage. If events with many simultaneous video rooms are planned, consider pre-emptively increasing the DO droplet size before the event.

**Comms template:**

> “The conference space is under heavy load and may feel slow. We’re working to stabilise things. Try refreshing if you’re disconnected.”

-----

### INC-07 · User Stuck / Frozen Avatar

**Symptoms:** One or a few users report they cannot move, or other users see their avatar frozen.

**Note:** This is almost always a client-side stale WebSocket connection. No server restart needed.

**Steps:**

1. Ask the affected user to hard-refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac).
1. If that doesn’t help, ask them to clear browser cache and reload.
1. If the problem affects many users simultaneously, it’s likely INC-02 (network error) — escalate to that runbook.

-----

### INC-08 · Authentication / OIDC Failure

**Symptoms:** Users are stuck on the login screen or receive an “invalid token” error after logging in.

**Triage steps:**

1. Check for clock skew between containers (a common cause of token validation failures):
   
   ```bash
   date
   docker compose exec play date
   docker compose exec back date
   # All three should show the same time within a few seconds
   ```
1. If clocks are out of sync, resync the VM:
   
   ```bash
   sudo systemctl restart systemd-timesyncd
   # or
   sudo ntpdate pool.ntp.org
   ```
1. Check OIDC-related logs:
   
   ```bash
   docker compose logs play | grep -i "oidc\|token\|auth\|openid"
   ```
1. Restart auth-related services:
   
   ```bash
   docker compose restart play back
   ```
1. If using an external OIDC provider, verify it is reachable from inside the container:
   
   ```bash
   docker compose exec play curl -I https://<your-oidc-provider>/.well-known/openid-configuration
   ```

-----

## Pre-Event Checklist

Run this 30–60 minutes before the conference starts.

```bash
# 1. All containers running
docker compose ps

# 2. No containers in restart loop
docker compose ps | grep -v "Up"

# 3. Disk space healthy
df -h   # confirm <80% used

# 4. Memory healthy
free -h   # confirm reasonable free memory

# 5. SSL cert valid
curl -vI https://<your-domain> 2>&1 | grep -i "expire\|SSL"

# 6. Map loads
curl -I https://<your-domain>/map-storage/<your-map>.json

# 7. Redis responding
docker compose exec redis redis-cli ping

# 8. Livekit healthy
docker compose logs --tail=20 livekit | grep -i "error\|warn"

# 9. Coturn healthy
docker compose logs --tail=20 coturn | grep -i "error\|warn"
```

-----

## Full Stack Restart Procedure

Use when multiple services are failing and targeted restarts haven’t worked.

**Expected downtime: ~60–90 seconds**

```bash
# 1. Notify attendees first (use comms template below)

# 2. Graceful stop
docker compose down

# 3. Wait for full shutdown
sleep 10

# 4. Start everything back up
docker compose up -d

# 5. Watch containers come healthy
watch docker compose ps

# 6. Confirm site is reachable
curl -I https://<your-domain>

# 7. Confirm Redis
docker compose exec redis redis-cli ping
```

**Comms template:**

> “We’re performing a quick restart of the conference space to resolve an issue. We expect to be back online within 2 minutes. Please hold tight.”

-----

## Post-Incident Notes Template

```
Date/Time:
Duration:
Incident type (INC-0X):
Summary of what happened:
Root cause (if known):
Fix applied:
Follow-up actions:
```

-----

*Playbook generated for a single DigitalOcean Ubuntu VM running WorkAdventure via Docker Compose with co-located Livekit and Coturn.*
