(() => {
  const form = document.querySelector("#deletionForm");
  const button = document.querySelector("#deletionButton");
  const message = document.querySelector("#deletionMessage");
  const client = window.supabase.createClient(
    window.CACHE_SUPABASE_URL,
    window.CACHE_SUPABASE_PUBLISHABLE_KEY
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirmation = form.elements.confirmation.value.trim();
    if (confirmation !== "DELETE") {
      message.textContent = "Type DELETE exactly to confirm account deletion.";
      message.classList.add("error");
      return;
    }

    button.disabled = true;
    message.classList.remove("error");
    message.textContent = "Confirming your sign-in…";
    try {
      const { data: auth, error: authError } = await client.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("We couldn't confirm that email and password. Check them and try again.");
      if (!auth.user?.id || !auth.session?.access_token) throw new Error("Sign-in could not be confirmed. Please try again.");

      message.textContent = "Deleting your CACHE account and private data…";
      const { error } = await client.functions.invoke("delete-account", {
        body: { confirmation },
        headers: { Authorization: "Bearer " + auth.session.access_token }
      });
      if (error) {
        let details;
        try { details = await error.context?.json(); } catch { /* Use the SDK's fallback message. */ }
        throw new Error(details?.error || error.message || "Account deletion did not finish.");
      }

      try {
        localStorage.removeItem("resellledger_data_v1:" + auth.user.id);
        localStorage.removeItem("resellledger_data_v1");
      } catch { /* Remote account deletion has already completed. */ }
      await client.auth.signOut({ scope: "local" });
      form.reset();
      message.textContent = "Your CACHE account and associated data have been permanently deleted.";
    } catch (error) {
      console.error("Account deletion did not finish:", error);
      message.textContent = error.message || "Deletion did not finish. Your sign-in remains active; some photos may already have been removed. Try again.";
      message.classList.add("error");
    } finally {
      button.disabled = false;
    }
  });
})();
