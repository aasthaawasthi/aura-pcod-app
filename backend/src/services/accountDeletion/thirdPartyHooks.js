// Where per-provider "also erase this person's data over there" calls
// live, once any third-party service is actually integrated (push
// notifications, a support-desk tool, an analytics vault, etc.). None of
// that exists in this app yet, so the list below is empty - this file is
// the seam to add to later, not something that needs restructuring when
// that day comes.
//
// Each hook is { name, run(userId) }. `run` should do whatever that
// provider's own data-deletion API calls for (e.g. revoke a stored OAuth
// token, call a "delete user" endpoint) and may be async/network-bound.
//
// Deliberately NOT run inside the same DB transaction as the account
// deletion: a third party being slow or temporarily unreachable must
// never block or roll back the user's own data actually being deleted,
// since that's the part compliance hinges on first. Each hook is run
// best-effort and independently logged - a failure here is a follow-up
// problem (retry later), not a reason to fail the user's delete request.
const HOOKS = [];

async function runDeletionHooks(userId) {
  const results = [];
  for (const hook of HOOKS) {
    try {
      await hook.run(userId);
      results.push({ name: hook.name, ok: true });
    } catch (err) {
      console.error(`[account-deletion] hook "${hook.name}" failed for user ${userId}:`, err);
      results.push({ name: hook.name, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = { HOOKS, runDeletionHooks };
