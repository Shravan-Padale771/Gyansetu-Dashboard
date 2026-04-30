"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, ExternalLink, ArrowLeft, Loader2, Image as ImageIcon, AlertTriangle } from "lucide-react";

// --- TRANSLATORS & EXTRACTORS ---
const resolveWixImage = (url) => {
  if (!url) return null;
  // If Wix gives us a normal web link (like in your JSON payload), just use it directly!
  if (url.startsWith("http")) return url; 
  
  // If they give us a weird Wix link, translate it
  const match = url.match(/wix:image:\/\/v1\/([^\/]+)/);
  if (match && match[1]) {
    const cleanHash = match[1].split('#')[0];
    return `https://static.wixstatic.com/media/${cleanHash}`;
  }
  return url;
};

const extractTextFromRichContent = (richContent) => {
  if (!richContent || !richContent.nodes) return "";
  let text = "";
  const traverse = (node) => {
    if (node.textData && node.textData.text) {
      text += node.textData.text + "\n\n"; 
    }
    if (node.nodes) {
      node.nodes.forEach(traverse);
    }
  };
  traverse(richContent);
  return text.trim();
};

export default function Dashboard() {
  const [blogs, setBlogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState("list"); 
  
  const [formData, setFormData] = useState({ id: "", title: "", content: "", imageUrl: "" });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingFullPost, setIsFetchingFullPost] = useState(false);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, blogId: null, confirmText: "" });
  const [editModal, setEditModal] = useState({ isOpen: false, blogId: null, confirmText: "" });

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      
      if (data.posts) {
        const normalizedPosts = data.posts.map(blog => ({
          ...blog,
          id: blog.id || blog._id || (blog.post ? (blog.post.id || blog.post._id) : null)
        }));
        setBlogs(normalizedPosts);
      }
    } catch (error) {
      console.error("Failed to fetch blogs:", error);
    }
    setIsLoading(false);
  };

  const executeDelete = async () => {
    if (!deleteModal.blogId) return alert("Error: ID missing.");
    try {
      await fetch(`/api/posts/${deleteModal.blogId}`, { method: "DELETE" });
      setBlogs(blogs.filter((blog) => blog.id !== deleteModal.blogId));
      setDeleteModal({ isOpen: false, blogId: null, confirmText: "" });
    } catch (error) {
      alert("Failed to delete blog.");
    }
  };

  const executeEdit = async () => {
    setIsFetchingFullPost(true);
    
    if (!editModal.blogId) {
      alert("Error: No ID found for this post.");
      setIsFetchingFullPost(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/posts/${editModal.blogId}`);
      const data = await res.json();
      const fullBlog = data.post || data; 

      if (fullBlog) {
        // Fallback chain: Check richContent -> plainContent -> excerpt
        const actualContent = extractTextFromRichContent(fullBlog.richContent) || fullBlog.plainContent || fullBlog.excerpt || "";
        
        // Check all the places Wix hides the image URL
        const rawImageUrl = fullBlog.coverMedia?.image?.url || fullBlog.media?.wixMedia?.image?.url || fullBlog.media?.image?.url;
        const actualImage = resolveWixImage(rawImageUrl);

        setFormData({
          id: fullBlog.id || fullBlog._id, 
          title: fullBlog.title,
          content: actualContent,
          imageUrl: actualImage || ""
        });
        
        setImagePreview(actualImage || "");
        setImageFile(null);
        setEditModal({ isOpen: false, blogId: null, confirmText: "" });
        setView("form");
      }
    } catch (err) {
      alert("Failed to fetch the full blog content.");
    }
    
    setIsFetchingFullPost(false);
  };

  const handleCreateNew = () => {
    setFormData({ id: "", title: "", content: "", imageUrl: "" });
    setImagePreview("");
    setImageFile(null);
    setView("form");
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file)); 
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      post: {
        title: formData.title,
        coverMedia: formData.imageUrl ? { image: { url: formData.imageUrl } } : undefined,
        richContent: {
          nodes: [{ type: "PARAGRAPH", id: "p1", nodes: [{ type: "TEXT", id: "t1", textData: { text: formData.content } }] }]
        }
      }
    };

    try {
      const method = formData.id ? "PATCH" : "POST";
      const endpoint = formData.id ? `/api/posts/${formData.id}` : "/api/posts";
      
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
         await fetchBlogs();
         setView("list");
      } else {
         const err = await res.json();
         alert("Failed to save: " + (err.error || "Unknown error"));
      }
    } catch (error) {
      alert("Failed to connect to server.");
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto relative">
        
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Content Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage publications securely</p>
          </div>
          {view === "list" && (
            <button onClick={handleCreateNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-indigo-200">
              <Plus size={18} /> New Blog
            </button>
          )}
        </header>

        <AnimatePresence mode="wait">
          {view === "list" ? (
            <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {isLoading ? (
                <div className="flex justify-center items-center h-64 text-slate-400">
                  <Loader2 className="animate-spin mr-2" size={24} /> Loading blogs...
                </div>
              ) : blogs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-slate-500 mb-4">No blogs published yet.</p>
                  <button onClick={handleCreateNew} className="text-indigo-600 font-medium hover:underline">Write your first post</button>
                </div>
              ) : (
                <div className="grid gap-6">
                  {blogs.map((blog) => {
                    // FIX: Checking 'media' instead of just 'coverMedia' based on your JSON
                    const rawImageUrl = blog.coverMedia?.image?.url || blog.media?.wixMedia?.image?.url || blog.media?.image?.url;
                    const coverImage = resolveWixImage(rawImageUrl); 
                    
                    return (
                      <div key={blog.id || Math.random()} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row overflow-hidden group">
                        
                        {coverImage && (
                          <div className="w-full md:w-48 h-48 md:h-auto bg-slate-100 relative shrink-0 border-r border-slate-100">
                            <img src={coverImage} alt={blog.title} className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div className="p-6 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-xl font-semibold mb-2 group-hover:text-indigo-600 transition-colors">{blog.title}</h3>
                            <p className="text-slate-500 line-clamp-2 text-sm leading-relaxed">
                              {/* FIX: Added blog.excerpt as a fallback so the cards aren't blank */}
                              {extractTextFromRichContent(blog.richContent) || blog.plainContent || blog.excerpt || "No content available."}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                            <p suppressHydrationWarning className="text-xs text-slate-400 font-medium tracking-wide uppercase">
                              {new Date(blog.firstPublishedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <div className="flex items-center gap-2">
                              <a href={blog.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                <ExternalLink size={18} />
                              </a>
                              <button onClick={() => setEditModal({ isOpen: true, blogId: blog.id, confirmText: "" })} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                <Edit2 size={18} />
                              </button>
                              <button onClick={() => setDeleteModal({ isOpen: true, blogId: blog.id, confirmText: "" })} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <button onClick={() => setView("list")} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors">
                <ArrowLeft size={16} className="mr-2" /> Back to list
              </button>
              
              <h2 className="text-2xl font-bold mb-8">{formData.id ? "Edit Blog Post" : "Draft New Post"}</h2>

              <form onSubmit={handleSave} className="space-y-6">
                
                <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center relative overflow-hidden group hover:border-indigo-400 transition-colors">
                  {imagePreview ? (
                    <div className="absolute inset-0 w-full h-full bg-slate-100">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-white px-4 py-2 rounded-lg font-medium shadow-sm border border-slate-200 text-sm">Click to change image</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4">
                      <ImageIcon className="mx-auto text-slate-400 mb-3" size={32} />
                      <p className="text-sm font-medium text-slate-700">Upload Cover Image</p>
                      <p className="text-xs text-slate-500 mt-1">Select a local file from your device</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Or use existing Image URL</label>
                  <input type="text" value={formData.imageUrl} onChange={(e) => { setFormData({...formData, imageUrl: e.target.value}); setImagePreview(e.target.value); }} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm" placeholder="https://..." />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Title</label>
                  <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all" placeholder="Enter an engaging title..." />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Main Content</label>
                  <textarea required rows={15} value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all resize-y leading-relaxed" placeholder="Write your content here..." />
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setView("list")} className="px-6 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex items-center px-6 py-2.5 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-70">
                    {isSaving ? <><Loader2 className="animate-spin mr-2" size={18} /> Publishing...</> : "Save & Publish"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- SECURITY MODALS --- */}
        <AnimatePresence>
          {deleteModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
                <div className="flex items-center gap-3 text-rose-600 mb-4"><AlertTriangle /> <h3 className="text-xl font-bold text-slate-900">Confirm Deletion</h3></div>
                <p className="text-slate-600 mb-6 text-sm">This action cannot be undone. To proceed, please type <strong className="text-slate-900 select-none">DELETE</strong> below.</p>
                <input type="text" value={deleteModal.confirmText} onChange={(e) => setDeleteModal({...deleteModal, confirmText: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 outline-none mb-6 font-mono" placeholder="Type DELETE" />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDeleteModal({ isOpen: false, blogId: null, confirmText: "" })} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button disabled={deleteModal.confirmText !== "DELETE"} onClick={executeDelete} className="px-4 py-2 font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 rounded-lg transition-colors">Permanently Delete</button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {editModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
                <div className="flex items-center gap-3 text-emerald-600 mb-4"><Edit2 /> <h3 className="text-xl font-bold text-slate-900">Confirm Edit</h3></div>
                <p className="text-slate-600 mb-6 text-sm">To modify this post, please type <strong className="text-slate-900 select-none">EDIT</strong> below.</p>
                <input type="text" value={editModal.confirmText} onChange={(e) => setEditModal({...editModal, confirmText: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none mb-6 font-mono" placeholder="Type EDIT" />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setEditModal({ isOpen: false, blogId: null, confirmText: "" })} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button disabled={editModal.confirmText !== "EDIT" || isFetchingFullPost} onClick={executeEdit} className="flex items-center px-4 py-2 font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-lg transition-colors">
                    {isFetchingFullPost ? <><Loader2 className="animate-spin mr-2" size={16} /> Fetching...</> : "Enter Edit Mode"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}