# STOP AND REPORT — end-of-procedure protocol

Applies to every agent at the end of any engineering, robotics, or project
procedure, or whenever you are told to stop. Run it in order, every time,
without being asked. It is common sense, written down.

## 1. Stop and pin
Freeze the work exactly where it is. Start nothing new. Note the exact
step of the procedure you are on.

## 2. Secure everything
Every artifact the project produced is saved, committed, and pushed: CAD,
source, build files, data, tables, images, reports. Nothing lives only in
the session. If it is not on GitHub, it does not exist.

## 3. Push to the project's own branch
Push to GitHub on a dedicated branch named for the project
(example: `two-arm-digital-gantry`). State the exact branch name in your
final message. No pull requests, no merge requests, no review requests.
Push the branch and stop.

## 4. Register the project
Add or update this project's row in the GitHub project list spreadsheet
(XLSX) at Documents → Robotics → Engineering → Robots → GitHub. Use the
existing file; create it only if it is missing. One row per design branch:
project name, repo, branch, current phase, status, last updated, link.

## 5. Make the folders
Create the standard project folder structure (as defined in the universal
prompt) if it does not already exist, and put every artifact in its folder.

## 6. Record your position
Write down where you are in the process: phase completed, phase in
progress, next step, open blockers.

## 7. Start or update the build report
What was built, what was decided, what is verified, what is unverified,
what is next. Publish every required table (motor table, BOM, pin map,
etc.) in full. A published table is complete: every row has its
dimensions, ratings, and source.

## 8. No "unknown" entries
"Unknown" is not a value. If a part has no datasheet, no repo, or no
dimensions:
1. Web-search it first.
2. If it cannot be found, design it yourself with stated assumptions and
   flag it as designed-not-sourced.
3. If you can do neither, tell me exactly what to search for.
Never ship a table row that reads "unknown".

## 9. Images and CAD views: pagination is mandatory
One clear subject per image. Legible labels, correct orientation, sane
scale. Images numbered and captioned in order. Laid out so they read
without zooming or scrolling. An image that cannot be read is a wasted
turn and gets redone before you report.

## 10. Push again, update, and report
After the reports, spreadsheet row, and folders are done, commit and push
everything once more, then give the final report in this shape:

```
Branch:            <exact branch name>
Repo:              <owner/repo>
Phase / status:    <where the procedure stopped>
Secured:           <CAD / code / tables / reports / images on the branch>
Spreadsheet row:   <updated | created>
Open unknowns:     <each one, and what you did about it>
Next step:         <the single next action>
```
