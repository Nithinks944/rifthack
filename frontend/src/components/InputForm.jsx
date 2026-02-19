import { useState } from 'react';

function InputForm({ onSubmit, isRunning }) {
  const [form, setForm] = useState({
    githubUrl: '',
    teamName: '',
    leaderName: '',
    retryLimit: 5
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({ ...form, retryLimit: Number(form.retryLimit || 5) });
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <label className="field-wrap md:col-span-4">
          <span className="field-label">GitHub Repository URL</span>
          <input
            name="githubUrl"
            type="url"
            required
            value={form.githubUrl}
            onChange={handleChange}
            placeholder="https://github.com/org/repo"
            className="field-input"
          />
        </label>

        <label className="field-wrap md:col-span-1">
          <span className="field-label">Team Name</span>
          <input
            name="teamName"
            type="text"
            required
            value={form.teamName}
            onChange={handleChange}
            placeholder="RIFT ORGANISERS"
            className="field-input"
          />
        </label>

        <label className="field-wrap md:col-span-1">
          <span className="field-label">Leader Name</span>
          <input
            name="leaderName"
            type="text"
            required
            value={form.leaderName}
            onChange={handleChange}
            placeholder="Saiyam Kumar"
            className="field-input"
          />
        </label>

        <label className="field-wrap md:col-span-1">
          <span className="field-label">Retry Limit</span>
          <input
            name="retryLimit"
            type="number"
            min="1"
            max="10"
            value={form.retryLimit}
            onChange={handleChange}
            className="field-input"
          />
        </label>

        <div className="flex items-end md:col-span-1">
          <button
            type="submit"
            disabled={isRunning}
            className="gradient-button h-11 w-full rounded-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? 'Agent Running...' : 'Run Agent'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default InputForm;
