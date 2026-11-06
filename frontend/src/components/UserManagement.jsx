import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  User,
  Trash2,
  Power,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { usersAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add User modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ACCOUNTANT');
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState('');

  // Role change / status confirmation state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    action: null
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await usersAPI.getUsers();
      if (res.success) {
        setUsers(res.users);
      }
    } catch (err) {
      setError(err.message || 'Failed to load user accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setModalError('');
    setCreating(true);

    if (!username.trim() || !password) {
      setModalError('Username and password are required');
      setCreating(false);
      return;
    }

    if (password.length < 6) {
      setModalError('Password must be at least 6 characters long');
      setCreating(false);
      return;
    }

    try {
      const res = await usersAPI.createUser({
        username: username.trim(),
        name: name.trim() || username.trim(),
        password,
        role
      });

      if (res.success) {
        setSuccess(`User account '${username.trim()}' created successfully as ${role}`);
        setShowAddModal(false);
        setUsername('');
        setName('');
        setPassword('');
        setRole('ACCOUNTANT');
        fetchUsers();
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      setModalError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = (targetUser, newRole) => {
    if (targetUser.role === newRole) return;

    setConfirmModal({
      isOpen: true,
      title: `Change Role to ${newRole}?`,
      message:
        newRole === 'ACCOUNTANT'
          ? `Are you sure you want to demote '${targetUser.username}' to ACCOUNTANT? They will lose access to suppliers, purchases, reports, and settings.`
          : `Grant ADMINISTRATOR access to '${targetUser.username}'? They will receive full application privileges.`,
      action: async () => {
        try {
          const res = await usersAPI.updateUserRole(targetUser.id || targetUser._id, newRole);
          if (res.success) {
            setSuccess(res.message || `Role updated to ${newRole}`);
            fetchUsers();
            setTimeout(() => setSuccess(''), 4000);
          }
        } catch (err) {
          setError(err.message || 'Failed to update user role');
          setTimeout(() => setError(''), 5000);
        }
      }
    });
  };

  const handleStatusToggle = (targetUser) => {
    const nextStatus = !targetUser.active;

    setConfirmModal({
      isOpen: true,
      title: `${nextStatus ? 'Activate' : 'Deactivate'} User?`,
      message: nextStatus
        ? `Re-activate '${targetUser.username}'? They will be able to log in again.`
        : `Deactivate '${targetUser.username}'? They will be immediately blocked from logging in.`,
      action: async () => {
        try {
          const res = await usersAPI.updateUserStatus(targetUser.id || targetUser._id, nextStatus);
          if (res.success) {
            setSuccess(res.message || `User status updated`);
            fetchUsers();
            setTimeout(() => setSuccess(''), 4000);
          }
        } catch (err) {
          setError(err.message || 'Failed to update user status');
          setTimeout(() => setError(''), 5000);
        }
      }
    });
  };

  const handleDeleteUser = (targetUser) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete User Account?`,
      message: `Permanently delete user '${targetUser.username}'? This cannot be undone.`,
      action: async () => {
        try {
          const res = await usersAPI.deleteUser(targetUser.id || targetUser._id);
          if (res.success) {
            setSuccess(res.message || 'User deleted successfully');
            fetchUsers();
            setTimeout(() => setSuccess(''), 4000);
          }
        } catch (err) {
          setError(err.message || 'Failed to delete user');
          setTimeout(() => setError(''), 5000);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Add User Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            <span>Staff & Role-Based Access Control</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage cashier and accountant accounts. Accountants are restricted strictly to buyer billing & daily tally.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchUsers}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setModalError('');
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 h-9 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Roles Legend / Security Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-emerald-950 flex items-center gap-2">
              <span>ADMIN</span>
              <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded">Full Access</span>
            </div>
            <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
              Unrestricted access: buyers, suppliers, purchase lots, supplier vouchers, profit reports, settings, and user management.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 mt-0.5">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-blue-950 flex items-center gap-2">
              <span>ACCOUNTANT</span>
              <span className="text-[10px] font-bold bg-blue-200/70 text-blue-900 px-1.5 py-0.2 rounded">Buyer Only</span>
            </div>
            <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
              Restricted to buyer operations: create bills, record payments, buyer ledgers, tally table, print buyer bills. Zero supplier or report access.
            </p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4 text-center">Assigned Role</th>
                <th className="py-3 px-4 text-center">Account Status</th>
                <th className="py-3 px-4 text-center">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = currentUser && (currentUser.id === u.id || currentUser.id === u._id);
                const isAdminRole = u.role === 'ADMIN';

                return (
                  <tr key={u.id || u._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isAdminRole ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {u.username?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{u.username}</span>
                            {isSelf && (
                              <span className="text-[10px] font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{u.name || 'Staff Member'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none ${
                          isAdminRole
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-blue-50 text-blue-800 border-blue-300'
                        }`}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="ACCOUNTANT">ACCOUNTANT</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          u.active !== false
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.active !== false ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                        {u.active !== false ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center text-xs text-slate-500 font-mono">
                      {u.createdAt ? formatDate(u.createdAt) : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(u)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            u.active !== false
                              ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50 border-slate-200'
                              : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border-slate-200'
                          }`}
                          title={u.active !== false ? 'Deactivate Account' : 'Re-activate Account'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isSelf ? 'Cannot delete logged in account' : 'Delete Account'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900">Add New User</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                    placeholder="e.g. ravi_cashier"
                    className="w-full h-10 pl-9 pr-3 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400">Lowercase alphanumeric characters only.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ravi (Counter Cashier)"
                  className="w-full h-10 px-3 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full h-10 pl-9 pr-3 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Role & Permissions <span className="text-red-600">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-10 px-3 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none cursor-pointer"
                >
                  <option value="ACCOUNTANT">ACCOUNTANT (Buyer Billing & Tally Only)</option>
                  <option value="ADMIN">ADMIN (Full Access to Everything)</option>
                </select>
                <span className="text-[10px] text-slate-400">
                  {role === 'ACCOUNTANT'
                    ? 'Accountant can create buyer bills and view tally table, but cannot see suppliers, purchase lots, reports or settings.'
                    : 'Admin has full access to suppliers, lots, deductions, ledgers, profit reports, and settings.'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{creating ? 'Creating...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-slate-900">{confirmModal.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', action: null })}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const act = confirmModal.action;
                  setConfirmModal({ isOpen: false, title: '', message: '', action: null });
                  if (act) await act();
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
