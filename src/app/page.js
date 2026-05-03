"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, ExternalLink, ArrowLeft, Loader2, Image as ImageIcon, AlertTriangle, LogOut, Mail, Globe, LayoutList, FileText, Lock, Eye, EyeOff } from "lucide-react";


const WIX_TAG_IDS = {
  mainBlog: "85b01d0b-ccc0-4308-b4a2-866178e1c650", 
  gyanSetu: "917e7353-c51a-4070-af78-e550b67c08b1",
  jpBordered: "6cfb82a7-9bd7-485e-af0b-9ed11a54115c"
};
// --- WIX API TRANSLATORS & EXTRACTORS ---
const getCoverImage = (blog) => {
  if (!blog) return null;
  const img = blog.coverMedia?.image || blog.media?.wixMedia?.image || blog.media?.image;
  if (!img) return null;
  if (img.url && img.url.startsWith("http")) return img.url;
  if (img.url && img.url.startsWith("wix:image")) {
    const match = img.url.match(/wix:image:\/\/v1\/([^\/]+)/);
    if (match && match[1]) {
      return `https://static.wixstatic.com/media/${match[1].split('#')[0]}`;
    }
  }
  if (img.id) return `https://static.wixstatic.com/media/${img.id}`;
  return null;
};

const extractTextFromRichContent = (richContent) => {
  if (!richContent || !richContent.nodes) return "";
  let text = "";
  const traverse = (node) => {
    if (node.textData && node.textData.text) text += node.textData.text + "\n\n"; 
    if (node.nodes) node.nodes.forEach(traverse);
  };
  traverse(richContent);
  return text.trim();
};

const getPostTags = (item) => {
  if (!item) return [];
  let allTags = [];
  if (item.hashtags) allTags = [...allTags, ...item.hashtags];
  if (item.tags) allTags = [...allTags, ...item.tags.map(t => typeof t === 'string' ? t : (t.label || t.name || ""))];
  if (item.post) {
    if (item.post.hashtags) allTags = [...allTags, ...item.post.hashtags];
    if (item.post.tags) allTags = [...allTags, ...item.post.tags.map(t => typeof t === 'string' ? t : (t.label || t.name || ""))];
  }
  return allTags.map(t => String(t).toLowerCase());
};

const checkPostType = (item) => {
  if (!item) return { isGyanSetu: false, isJP: false, isNewsletter: false, isBlog: true };
  const p = item.post || item;
  const tags = getPostTags(p);
  const tIds = p.tagIds || []; 
  
  const isGyanSetu = tags.some(t => t.includes("gyansetu")) || tIds.includes(WIX_TAG_IDS.gyanSetu);
  const isJP = tags.some(t => t.includes("jp")) || tIds.includes(WIX_TAG_IDS.jpBordered);
  const isNewsletter = isGyanSetu || isJP || tags.some(t => t.includes("newsletter"));
  
  return { isGyanSetu, isJP, isNewsletter, isBlog: !isNewsletter };
};

export default function Dashboard() {
  const router = useRouter(); 
  
  // --- AUTHENTICATION STATE ---
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("editor"); 
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Eye toggle state
  
  const [blogs, setBlogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState("list"); 
  const [activeTab, setActiveTab] = useState("newsletters"); 
  
  const [formData, setFormData] = useState({ 
    id: "", title: "", content: "", imageUrl: "", imageId: "", 
    mainType: "newsletter", 
    department: "gyan-setu" 
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingFullPost, setIsFetchingFullPost] = useState(false);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, blogId: null, confirmText: "" });
  const [editModal, setEditModal] = useState({ isOpen: false, blogId: null, confirmText: "" });

  // --- PERSISTENT SESSION CHECK ---
  useEffect(() => {
    const savedUser = localStorage.getItem("dashUser");
    const savedRole = localStorage.getItem("dashRole");
    
    if (savedUser && savedRole) {
      setCurrentUser(savedUser);
      setUserRole(savedRole);
    }
    setIsCheckingSession(false);
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchBlogs();
    }
  }, [currentUser]);

  // --- LOGIN HANDLER ---
  const handleLogin = (e) => {
    e.preventDefault();
    const cleanName = usernameInput.trim().toLowerCase();
    
    if (!cleanName || !passwordInput) return alert("Please enter a username and password.");

    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    const editorPassword = process.env.NEXT_PUBLIC_EDITOR_PASSWORD;

    if (cleanName === "gyansetu" && passwordInput === adminPassword) {
      setUserRole("admin");
      setCurrentUser("GyanSetu");
      localStorage.setItem("dashUser", "GyanSetu");
      localStorage.setItem("dashRole", "admin");
    } 
    else if (cleanName !== "gyansetu" && passwordInput === editorPassword) {
      setUserRole("editor");
      setActiveTab("newsletters"); 
      setCurrentUser(cleanName);
      localStorage.setItem("dashUser", cleanName);
      localStorage.setItem("dashRole", "editor");
    } 
    else {
      alert("Invalid username or password.");
      return;
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUsernameInput("");
    setPasswordInput("");
    setShowPassword(false);
    setUserRole("editor");
    localStorage.removeItem("dashUser");
    localStorage.removeItem("dashRole");
  };

  const fetchBlogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      if (data.posts) {
        const normalizedPosts = data.posts.map(item => {
          const p = item.post || item;
          return { ...p, id: p.id || p._id };
        });
        setBlogs(normalizedPosts);
      }
    } catch (error) {
      console.error("Failed to fetch blogs:", error);
    }
    setIsLoading(false);
  };

  const displayedPosts = blogs.filter(blog => {
    const { isNewsletter } = checkPostType(blog);
    if (activeTab === "newsletters") return isNewsletter;
    return !isNewsletter;
  });

  const executeDelete = async () => {
    if (!deleteModal.blogId) return;
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
    try {
      const res = await fetch(`/api/posts/${editModal.blogId}`);
      const data = await res.json();
      const fullBlog = data.post || data; 

      if (fullBlog) {
        const actualContent = extractTextFromRichContent(fullBlog.richContent) || fullBlog.plainContent || fullBlog.excerpt || "";
        const actualImage = getCoverImage(fullBlog);
        const rawId = fullBlog.coverMedia?.image?.id || fullBlog.media?.wixMedia?.image?.id || fullBlog.media?.image?.id || "";
        
        const { isNewsletter, isJP } = checkPostType(fullBlog);
        
        const loadedMainType = isNewsletter ? "newsletter" : "blog";
        const loadedDept = isJP ? "jp-bordered" : "gyan-setu";

        setFormData({
          id: fullBlog.id || fullBlog._id, 
          title: fullBlog.title,
          content: actualContent,
          imageUrl: actualImage || "",
          imageId: rawId,
          mainType: loadedMainType,
          department: loadedDept
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
    const defaultType = activeTab === "blogs" ? "blog" : "newsletter";
    setFormData({ id: "", title: "", content: "", imageUrl: "", imageId: "", mainType: defaultType, department: "gyan-setu" });
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

  const handleContentChange = (e) => {
    const text = e.target.value;
    
    if (formData.mainType === "newsletter") {
      const words = text.trim().split(/\s+/).filter(Boolean);
      if (words.length > 500) {
        const truncated = words.slice(0, 500).join(" ");
        setFormData({ ...formData, content: truncated + " " });
        return;
      }
    }
    setFormData({ ...formData, content: text });
  };

  const currentWordCount = formData.content.trim().split(/\s+/).filter(Boolean).length;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    let finalImageUrl = formData.imageUrl; 
    let finalImageId = formData.imageId;

    if (imageFile) {
      const uploadData = new FormData();
      uploadData.append("image", imageFile);
      try {
        const imgRes = await fetch('/api/upload', { method: "POST", body: uploadData });
        const imgJson = await imgRes.json();
        if (imgJson.success) {
          finalImageUrl = imgJson.url; 
          finalImageId = imgJson.id; 
        } else {
          alert("Wix Media Upload failed");
          setIsSaving(false); return;
        }
      } catch (error) {
        alert("Upload error."); setIsSaving(false); return;
      }
    }

    let fallbackId = finalImageId;
    if (!fallbackId && finalImageUrl && finalImageUrl.startsWith("wix:image")) {
       const match = finalImageUrl.match(/wix:image:\/\/v1\/([^\/]+)/);
       if (match) fallbackId = match[1].split('/')[0];
    }

    const imagePayload = finalImageUrl ? { image: { url: finalImageUrl, id: fallbackId || undefined } } : undefined;
    const contentNodes = [];
    if (imagePayload) {
      contentNodes.push({ type: "IMAGE", id: "main-image", nodes: [], imageData: { containerData: { alignment: "CENTER", width: { custom: "100%" } }, image: { src: { id: imagePayload.image.id || "", url: imagePayload.image.url || "" } } } });
    }
    contentNodes.push({ type: "PARAGRAPH", id: "p1", nodes: [{ type: "TEXT", id: "t1", textData: { text: formData.content } }] });

    let currentHashtags = [];
    let currentTagIds = [];

    if (formData.mainType === "newsletter") {
        if (formData.department === "gyan-setu") {
            currentHashtags.push("newsletter-gyansetu");
            if (WIX_TAG_IDS.gyanSetu !== "PASTE_GYAN_SETU_ID_HERE") currentTagIds.push(WIX_TAG_IDS.gyanSetu);
        } else {
            currentHashtags.push("newsletter-jp");
            if (WIX_TAG_IDS.jpBordered !== "PASTE_JP_BORDERED_ID_HERE") currentTagIds.push(WIX_TAG_IDS.jpBordered);
        }
    } else {
        currentHashtags.push("main-blog");
        if (WIX_TAG_IDS.mainBlog !== "PASTE_MAIN_BLOG_ID_HERE") currentTagIds.push(WIX_TAG_IDS.mainBlog);
        currentHashtags.push(formData.department === "gyan-setu" ? "dept-gyansetu" : "dept-jp");
    }

    const payload = {
      post: {
        title: formData.title,
        hashtags: currentHashtags, 
        tagIds: currentTagIds.length > 0 ? currentTagIds : undefined,
        coverMedia: imagePayload,
        richContent: { nodes: contentNodes }
      }
    };

    try {
      const endpoint = formData.id ? `/api/posts/${formData.id}` : "/api/posts";
      const res = await fetch(endpoint, { method: formData.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
         await fetchBlogs();
         setView("list");
      } else {
         alert("Failed to save.");
      }
    } catch (error) { alert("Server error."); }
    setIsSaving(false);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 w-full max-w-md text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-indigo-100">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Login</h1>
          <p className="text-slate-500 mb-8 text-sm">Please enter your assigned credentials.</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="text-left">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Username</label>
              <input type="text" required value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="guest" className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white placeholder:text-slate-400" />
            </div>
            
            {/* --- PASSWORD FIELD WITH EYE ICON --- */}
            <div className="text-left">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={passwordInput} 
                  onChange={(e) => setPasswordInput(e.target.value)} 
                  placeholder="Enter password" 
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white placeholder:text-slate-400" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex="-1" // Keeps the tab flow clean
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button type="submit" className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-indigo-200 mt-2">Access Dashboard</button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto relative">
        
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Content Dashboard</h1>
            <p className="text-slate-500 mt-1">Logged in as <span className="font-bold text-indigo-600 uppercase tracking-wider text-xs ml-1">{currentUser}</span> <span className="text-slate-400 mx-2">|</span> Role: <span className="font-semibold capitalize text-slate-700">{userRole}</span></p>
          </div>
          {view === "list" && (
            <div className="flex items-center gap-4">
              <button onClick={handleLogout} className="flex items-center text-slate-500 hover:text-rose-600 font-medium transition-colors text-sm bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm"><LogOut size={16} className="mr-1.5" /> Log Out</button>
              <button onClick={handleCreateNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-indigo-200"><Plus size={18} /> New Draft</button>
            </div>
          )}
        </header>

        {view === "list" && (
          <div className="flex gap-2 mb-8 border-b border-slate-200 pb-px">
            <button onClick={() => setActiveTab("newsletters")} className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === "newsletters" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}><LayoutList size={18} /> Newsletters</button>
            {userRole === "admin" && (
              <button onClick={() => setActiveTab("blogs")} className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === "blogs" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}><FileText size={18} /> Standard Blogs</button>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "list" ? (
            <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {isLoading ? (
                <div className="flex justify-center items-center h-64 text-slate-400"><Loader2 className="animate-spin mr-2" size={24} /> Loading content...</div>
              ) : displayedPosts.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-slate-500 mb-4">No {activeTab} published yet.</p>
                  <button onClick={handleCreateNew} className="text-indigo-600 font-medium hover:underline">Write your first post</button>
                </div>
              ) : (
                <div className="grid gap-6">
                  {displayedPosts.map((blog) => {
                    const innerPost = blog.post || blog; 
                    const coverImage = getCoverImage(innerPost); 
                    
                    const { isGyanSetu, isJP, isBlog } = checkPostType(innerPost);
                    
                    const liveUrl = innerPost.url || `https://www.yourwebsite.com/post/${innerPost.slug}`;

                    return (
                      <div key={innerPost.id || Math.random()} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row overflow-hidden group relative">
                        
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                          <div className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1 ${isBlog ? "bg-slate-800 text-white" : "bg-purple-600 text-white"}`}>
                            {isBlog ? "Blog" : "Newsletter"}
                          </div>
                          {isGyanSetu && <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1"><Mail size={12} /> Gyan Setu</div>}
                          {isJP && <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1"><Globe size={12} /> JP-Bordered</div>}
                        </div>

                        {coverImage && (
                          <div className="w-full md:w-48 h-48 md:h-auto bg-slate-100 relative shrink-0 border-r border-slate-100">
                            <img src={coverImage} alt={innerPost.title} className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div className="p-6 flex-1 flex flex-col justify-between">
                          <div className={coverImage ? "" : "mt-8"}>
                            <h3 className="text-xl font-semibold mb-2 group-hover:text-indigo-600 transition-colors">{innerPost.title}</h3>
                            <p className="text-slate-500 line-clamp-2 text-sm leading-relaxed">{extractTextFromRichContent(innerPost.richContent) || innerPost.plainContent || innerPost.excerpt || "No content available."}</p>
                          </div>
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                            <p suppressHydrationWarning className="text-xs text-slate-400 font-medium tracking-wide uppercase">{new Date(innerPost.firstPublishedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            
                            <div className="flex items-center gap-2">
                              <a href={liveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><ExternalLink size={16} /> View Live</a>
                              <button onClick={() => setEditModal({ isOpen: true, blogId: innerPost.id, confirmText: "" })} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit Post"><Edit2 size={18} /></button>
                              <button onClick={() => setDeleteModal({ isOpen: true, blogId: innerPost.id, confirmText: "" })} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Post"><Trash2 size={18} /></button>
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
              <button type="button" onClick={() => setView("list")} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"><ArrowLeft size={16} className="mr-2" /> Back to list</button>
              
              <form onSubmit={handleSave} className="space-y-6">
                
                <div className="flex justify-center mb-6">
                  <div className="w-full max-w-[200px] aspect-square border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-center relative overflow-hidden group hover:border-indigo-400 transition-colors flex flex-col items-center justify-center">
                    {imagePreview ? (
                      <div className="absolute inset-0 w-full h-full bg-slate-100">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="bg-white/90 backdrop-blur-sm text-slate-800 px-3 py-1.5 rounded font-bold shadow-sm border border-slate-200 text-xs">Change Image</span></div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <ImageIcon className="mx-auto text-slate-400 mb-2" size={32} strokeWidth={1.5} />
                        <p className="text-sm font-bold text-slate-700">Cover Image</p>
                        <p className="text-xs text-slate-500 mt-1">1:1 Square Ratio</p>
                        <p className="text-[10px] font-bold text-indigo-600 mt-3 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md inline-block">Click to Upload</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  </div>
                </div>
                
                <div className="flex flex-col p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 gap-5">
                  
                  {userRole === "admin" && activeTab === "blogs" && (
                    <div className="pb-4 border-b border-indigo-100/70">
                      <label className="text-sm font-bold text-indigo-900 mb-3 block">1. What are you publishing?</label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" value="blog" checked={formData.mainType === "blog"} onChange={() => setFormData({ ...formData, mainType: "blog" })} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm font-semibold text-slate-700">Standard Blog</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" value="newsletter" checked={formData.mainType === "newsletter"} onChange={() => setFormData({ ...formData, mainType: "newsletter" })} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm font-semibold text-slate-700">Newsletter</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-bold text-indigo-900 mb-2 block">
                      {(userRole === "admin" && activeTab === "blogs") ? "2. Which department is this for?" : "Which department is this newsletter for?"}
                    </label>
                    <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-indigo-200 text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white cursor-pointer">
                      <option value="gyan-setu">Gyan Setu</option>
                      <option value="jp-bordered">JP-Bordered & Aspirational States</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Title</label>
                  <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-none" />
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-semibold text-slate-700">Main Content</label>
                    <span className={`text-xs font-bold ${formData.mainType === "newsletter" && currentWordCount >= 500 ? "text-rose-600" : "text-slate-500"}`}>
                      {currentWordCount} {formData.mainType === "newsletter" ? "/ 500 Words Max" : "Words"}
                    </span>
                  </div>
                  <textarea required rows={15} value={formData.content} onChange={handleContentChange} placeholder={formData.mainType === "newsletter" ? "Start writing your newsletter... (500 word limit)" : "Write your blog post here..."} className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-none resize-y leading-relaxed" />
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setView("list")} className="px-6 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex items-center px-6 py-2.5 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-70">
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
                <input type="text" value={deleteModal.confirmText} onChange={(e) => setDeleteModal({...deleteModal, confirmText: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none mb-6 font-mono" placeholder="Type DELETE" />
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
                <input type="text" value={editModal.confirmText} onChange={(e) => setEditModal({...editModal, confirmText: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none mb-6 font-mono" placeholder="Type EDIT" />
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