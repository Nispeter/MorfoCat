# Code signing policy

MorfoCat's Windows installers are digitally signed so that Windows can show who
published them and confirm the file has not been altered on its way to you.

## Certificate

Free code signing is provided by [SignPath.io](https://signpath.io), with a
certificate issued by the [SignPath Foundation](https://signpath.org).

Signing happens inside the release workflow in
[`.github/workflows/build.yml`](../.github/workflows/build.yml): the installers
are built by GitHub Actions from a tagged commit of this repository and
submitted to SignPath from that same run. Nothing is signed from a personal
machine, and nothing that was not built from this repository's source is ever
submitted.

## Team roles

MorfoCat is maintained by one person, who therefore holds all three roles:

| Role | Who | Responsibility |
| --- | --- | --- |
| Author | Nicolás Parra García ([@Nispeter](https://github.com/Nispeter)) | Writes and modifies the source code |
| Reviewer | Nicolás Parra García | Reviews and merges changes |
| Approver | Nicolás Parra García | Authorises each signing request |

Multi-factor authentication is required on both the GitHub account and the
SignPath account. Should other maintainers join, this table is updated before
they are granted any of these roles.

## Privacy

MorfoCat does not collect anything.

- No telemetry, analytics, crash reporting, or usage statistics.
- No network requests: every analysis runs locally, in a bundled Python engine
  that communicates with the application over standard input and output.
- No accounts, and no data leaves your computer. Your images, landmark files and
  projects are read and written only where you choose to put them.

Because nothing is collected, there is nothing to opt out of and no separate
privacy policy to accept.

## Uninstalling

The Windows installer registers MorfoCat with **Settings › Apps › Installed
apps**, where it can be removed like any other program. Uninstalling removes the
application and its bundled engine; project and landmark files you created are
left alone, since they live wherever you saved them.

## Reporting a problem

If an installer appears to be signed but behaves unexpectedly, or if you find a
copy of MorfoCat distributed somewhere unofficial, please open an issue at
<https://github.com/Nispeter/MorfoCat/issues>. Official releases are published
only on that repository's Releases page.
