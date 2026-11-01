import { withSupabase } from "@supabase/server";

const projectUrl = Deno.env.get("SUPABASE_URL");
if (!projectUrl) throw new Error("SUPABASE_URL is required.");
const projectIssuer = new URL("/auth/v1", projectUrl).toString();

const deleteAccount = withSupabase(
  { auth: "user", issuer: projectIssuer },
  async (request, { supabaseAdmin, userClaims }) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Use POST to request account deletion." }, { status: 405 });
    }
    if (!userClaims?.id || userClaims.role !== "authenticated") {
      return Response.json({ error: "Sign in to delete your CACHE account." }, { status: 401 });
    }

    let body: { confirmation?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Confirm the account deletion and try again." }, { status: 400 });
    }
    if (body.confirmation !== "DELETE") {
      return Response.json({ error: "Account deletion was not confirmed." }, { status: 400 });
    }

    const userId = userClaims.id;
    const storage = supabaseAdmin.storage.from("cache-item-photos");

    try {
      const files = await listUserFiles(storage, userId, userId);
      for (let index = 0; index < files.length; index += 1000) {
        const { error } = await storage.remove(files.slice(index, index + 1000));
        if (error) throw error;
      }

      // The user-data row is removed by its auth.users ON DELETE CASCADE foreign key.
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId, false);
      if (deleteError) throw deleteError;

      return Response.json({ ok: true, message: "Account and associated CACHE data deleted." });
    } catch (error) {
      console.error("CACHE account deletion failed before auth-user removal:", error);
      return Response.json({
        error: "Deletion did not finish. Your sign-in account remains active; some private photos may already have been removed. Try again."
      }, { status: 500 });
    }
  }
);

async function listUserFiles(
  storage: {
    list: (folder: string, options: { limit: number; offset: number }) => Promise<{
      data: Array<{ name: string; id: string | null }> | null;
      error: Error | null;
    }>;
    remove: (paths: string[]) => Promise<{ error: Error | null }>;
  },
  rootUserId: string,
  folder: string
): Promise<string[]> {
  // Keep the service-role client inside the verified caller's folder tree.
  if (folder !== rootUserId && !folder.startsWith(`${rootUserId}/`)) {
    throw new Error("Storage path escaped the signed-in user's folder.");
  }
  const filePaths: string[] = [];
  const subfolders: string[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await storage.list(folder, { limit: pageSize, offset });
    if (error) throw error;
    const entries = data || [];
    for (const entry of entries) {
      if (!entry.name || entry.name === "." || entry.name === ".." || entry.name.includes("/") || entry.name.includes("\\")) {
        throw new Error("Storage returned an invalid path entry.");
      }
      const path = `${folder}/${entry.name}`;
      if (entry.id == null) subfolders.push(path);
      else filePaths.push(path);
    }
    if (entries.length < pageSize) break;
  }

  for (const subfolder of subfolders) {
    filePaths.push(...await listUserFiles(storage, rootUserId, subfolder));
  }

  return filePaths;
}

export default { fetch: deleteAccount };
