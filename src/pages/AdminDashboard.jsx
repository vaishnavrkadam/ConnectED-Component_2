import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useCollection } from '../hooks/useCollection.js';
import { deleteFaculty, facultyQuery, saveFaculty } from '../services/facultyService.js';
import { allTeamsQuery, deleteTeam, manuallyAssignTeam, pendingAllocationsQuery, submitTeam } from '../services/teamService.js';
import { parseTeamsCsv } from '../utils/teamCsv.js';

const emptyFaculty = {
  facultyId: '',
  facultyName: '',
  expertise: [],
  maxTeams: 3,
  allocatedTeams: 0,
  email: '',
};

const sampleCsv = [
  'TEAM LEADER,STUDENT1,STUDENT2,STUDENT3,STUDENT4,PROJECT TOPIC',
  'Asha Patil,Ravi Shah,Meera Iyer,Dev Nair,Neha Rao,AI attendance monitoring system',
  'Kiran More,Anaya Singh,Om Joshi,Priya Das,Rohan Kale,IoT smart irrigation',
].join('\n');

function facultyDepartment(item) {
  return item.department || item.expertise?.[0] || 'Engineering';
}

function facultyAllocationCounts(teams) {
  return teams.reduce((counts, team) => {
    const facultyId = team.allocatedFaculty?.id;
    if (!facultyId) return counts;
    counts.set(facultyId, (counts.get(facultyId) || 0) + 1);
    return counts;
  }, new Map());
}

function loadPercent(item, allocatedTeams) {
  const maxTeams = Number(item.maxTeams || 0);
  if (!maxTeams) return 0;
  return Math.min((allocatedTeams / maxTeams) * 100, 100);
}

function statusColor(status) {
  if (status === 'AUTO_ALLOCATED') return 'secondary';
  if (status === 'MANUALLY_ALLOCATED') return 'default';
  if (status === 'PENDING') return 'warning';
  return 'info';
}

export default function AdminDashboard() {
  const [facultyForm, setFacultyForm] = useState(emptyFaculty);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [teamTab, setTeamTab] = useState('ALL');
  const { data: faculty, loading: facultyLoading, error: facultyError } = useCollection(useMemo(() => facultyQuery(), []));
  const { data: teams, loading: teamsLoading } = useCollection(useMemo(() => allTeamsQuery(), []));
  const { data: pending } = useCollection(useMemo(() => pendingAllocationsQuery(), []));
  const facultyLoads = useMemo(() => facultyAllocationCounts(teams), [teams]);

  const visibleFaculty = faculty.filter((item) => {
    const text = `${item.facultyName} ${item.email} ${facultyDepartment(item)} ${item.expertise?.join(' ')}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const stats = useMemo(() => {
    const allocated = teams.filter((team) => team.allocatedFaculty).length;
    const capacity = faculty.reduce((sum, item) => sum + Number(item.maxTeams || 0), 0);
    return {
      totalTeams: teams.length,
      allocated,
      pending: teams.filter((team) => team.status === 'PENDING').length,
      capacity,
      filled: allocated,
    };
  }, [teams, faculty]);

  const filteredTeams = useMemo(() => {
    if (teamTab === 'PENDING') return teams.filter((team) => team.status === 'PENDING');
    if (teamTab === 'AUTO') return teams.filter((team) => team.status === 'AUTO_ALLOCATED');
    if (teamTab === 'MANUAL') return teams.filter((team) => team.status === 'MANUALLY_ALLOCATED');
    return teams;
  }, [teamTab, teams]);

  const handleSaveFaculty = async (event) => {
    event.preventDefault();
    try {
      await saveFaculty(facultyForm, editingId);
      setFacultyForm(emptyFaculty);
      setEditingId(null);
      setNotice('Faculty saved.');
    } catch (error) {
      setNotice(error.message);
    }
  };

  const editFaculty = (item) => {
    setEditingId(item.id);
    setFacultyForm({ ...item, expertise: item.expertise || [] });
  };

  const assign = async (team, facultyId) => {
    const selected = faculty.find((item) => item.id === facultyId);
    if (!selected) return;
    await manuallyAssignTeam(team.id, selected);
    setNotice(`Assigned ${selected.facultyName}.`);
  };

  const removeTeam = async (team) => {
    await deleteTeam(team.id);
    setNotice(`Deleted ${team.teamLeader || 'team'} and released its faculty slot.`);
  };

  const handleTeamCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBulkUploading(true);
    try {
      const csvText = await file.text();
      const parsedTeams = parseTeamsCsv(csvText);

      for (const team of parsedTeams) {
        await submitTeam(team);
      }

      setNotice(`Uploaded and auto-allocated ${parsedTeams.length} teams.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBulkUploading(false);
    }
  };

  const downloadSample = () => {
    const url = window.URL.createObjectURL(new window.Blob([sampleCsv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'team-upload-sample.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ bgcolor: '#000000', mx: { xs: -2, sm: -3 }, my: -4, minHeight: 'calc(100vh - 64px)', px: { xs: 2, sm: 3 }, py: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Dashboard
          </Typography>
        </Stack>

        {(facultyLoading || teamsLoading) && <LinearProgress />}
        {facultyError && <Alert severity="error">{facultyError.message}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ boxShadow: '0 8px 18px rgba(16, 36, 62, 0.08)' }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={700}>Total Teams</Typography>
                    <Typography variant="h4" sx={{ color: '#1976a3', fontWeight: 900 }}>
                      {stats.totalTeams}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: '#e2f0fb', color: '#1976a3' }}>
                    <FolderIcon />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ boxShadow: '0 8px 18px rgba(16, 36, 62, 0.08)' }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={700}>Allocated</Typography>
                    <Typography variant="h4" sx={{ color: '#2e9b5f', fontWeight: 900 }}>
                      {stats.allocated}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: '#e3f6e9', color: '#2e9b5f' }}>
                    <CheckCircleIcon />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ boxShadow: '0 8px 18px rgba(16, 36, 62, 0.08)' }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={700}>Pending</Typography>
                    <Typography variant="h4" sx={{ color: '#c89423', fontWeight: 900 }}>
                      {stats.pending}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: '#fff3d8', color: '#c89423' }}>
                    <WarningAmberIcon />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ boxShadow: '0 8px 18px rgba(16, 36, 62, 0.08)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography fontWeight={700}>Faculty Capacity</Typography>
                <LinearProgress
                  variant="determinate"
                  value={stats.capacity ? (stats.filled / stats.capacity) * 100 : 0}
                  sx={{ height: 10, borderRadius: 99, my: 1.2, bgcolor: '#d9edf8' }}
                />
                <Typography variant="body2">
                  {stats.filled} / {stats.capacity} slots filled
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Bulk Team Upload</Typography>
            <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={downloadSample}>
              More Info
            </Button>
          </Stack>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Button
                component="label"
                disabled={bulkUploading}
                fullWidth
                sx={{
                  minHeight: 72,
                  border: '1px dashed #4f6070',
                  color: '#f4f8fc',
                  bgcolor: '#12181f',
                  justifyContent: 'center',
                  '&:hover': {
                    bgcolor: '#18212a',
                    borderColor: '#7dbff2',
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <UploadFileIcon sx={{ color: '#8fc8f4' }} />
                  <Typography variant="body2">Drag & Drop CSV here or Click to Browse</Typography>
                </Stack>
                <input type="file" accept=".csv,text/csv" hidden onChange={handleTeamCsvUpload} />
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Alert severity="info" sx={{ minHeight: 72, alignItems: 'center', boxShadow: '0 4px 14px rgba(44, 117, 154, 0.12)' }}>
                Supported headers: TOPIC, PROJECT TITLE, TEAM LEADER, STUDENT1-STUDENT5, MEMBERS.
                <Button size="small" onClick={downloadSample} sx={{ ml: 0.5 }}>
                  Download Sample Template
                </Button>
              </Alert>
            </Grid>
          </Grid>
          {bulkUploading && <LinearProgress sx={{ mt: 1.5 }} />}
        </Box>

        <Card sx={{ boxShadow: '0 8px 18px rgba(16, 36, 62, 0.08)' }}>
          <CardContent sx={{ p: 0 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ p: 2, pb: 1 }}>
              <Typography variant="h6">Faculty Management</Typography>
              <TextField
                placeholder="Search by Name, Department, Expertise..."
                size="small"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
                sx={{ minWidth: { md: 360 } }}
              />
            </Stack>
            <Stack component="form" direction={{ xs: 'column', lg: 'row' }} spacing={1.2} sx={{ px: 2, pb: 2 }} onSubmit={handleSaveFaculty}>
              <TextField label="Faculty ID" size="small" value={facultyForm.facultyId} onChange={(event) => setFacultyForm((current) => ({ ...current, facultyId: event.target.value }))} required />
              <TextField label="Name" size="small" value={facultyForm.facultyName} onChange={(event) => setFacultyForm((current) => ({ ...current, facultyName: event.target.value }))} required />
              <TextField
                label="Expertise"
                size="small"
                value={facultyForm.expertise.join(', ')}
                onChange={(event) => setFacultyForm((current) => ({ ...current, expertise: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))}
                required
              />
              <TextField label="Max" size="small" type="number" value={facultyForm.maxTeams} onChange={(event) => setFacultyForm((current) => ({ ...current, maxTeams: event.target.value }))} inputProps={{ min: 1 }} required />
              <TextField label="Email" size="small" type="email" value={facultyForm.email} onChange={(event) => setFacultyForm((current) => ({ ...current, email: event.target.value }))} required />
              <Button type="submit" variant="contained" startIcon={editingId ? <SaveIcon /> : <AddIcon />}>
                {editingId ? 'Save' : 'Add'}
              </Button>
            </Stack>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#101820', '& .MuiTableCell-root': { color: '#f4f8fc', fontWeight: 800 } }}>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Expertise</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Load</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleFaculty.map((item) => {
                  const allocatedTeams = facultyLoads.get(item.id) || 0;
                  const percent = loadPercent(item, allocatedTeams);
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.facultyName}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {item.expertise?.map((skill, index) => (
                            <Chip
                              key={skill}
                              label={skill}
                              size="small"
                              sx={{ mb: 0.5, bgcolor: index % 2 ? '#2e9b5f' : '#1976a3', color: 'white' }}
                            />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>{facultyDepartment(item)}</TableCell>
                      <TableCell sx={{ minWidth: 130 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LinearProgress
                            variant="determinate"
                            value={percent}
                            color={percent >= 100 ? 'error' : 'success'}
                            sx={{ flex: 1, height: 6, borderRadius: 99 }}
                          />
                          <Typography variant="body2">
                            {allocatedTeams} / {item.maxTeams}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => editFaculty(item)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => deleteFaculty(item.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card sx={{ boxShadow: '0 8px 18px rgba(16, 36, 62, 0.08)' }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2, pb: 0 }}>
              <Typography variant="h6">Teams & Manual Overrides</Typography>
              <Tabs value={teamTab} onChange={(_event, value) => setTeamTab(value)} sx={{ minHeight: 42 }}>
                <Tab value="ALL" label="All Teams" />
                <Tab value="PENDING" label="Pending Allocation" />
                <Tab value="AUTO" label="Auto-Allocated" />
                <Tab value="MANUAL" label="Manual Overrides" />
              </Tabs>
            </Box>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#101820', '& .MuiTableCell-root': { color: '#f4f8fc', fontWeight: 800 } }}>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Team / Topic</TableCell>
                  <TableCell>Mentor</TableCell>
                  <TableCell>Manual assign</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id} hover>
                    <TableCell>
                      <Chip label={team.status} size="small" color={statusColor(team.status)} />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700}>{team.topic}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {team.teamLeader} - {team.category}
                      </Typography>
                    </TableCell>
                    <TableCell>{team.allocatedFaculty?.facultyName || 'Unassigned'}</TableCell>
                    <TableCell sx={{ minWidth: 280 }}>
                      <TextField select size="small" fullWidth label="Search for faculty..." value="" onChange={(event) => assign(team, event.target.value)}>
                        {faculty
                          .filter((item) => Number(facultyLoads.get(item.id) || 0) < Number(item.maxTeams || 0))
                          .map((item) => (
                            <MenuItem key={item.id} value={item.id}>
                              {item.facultyName}
                            </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete team">
                        <IconButton size="small" color="error" onClick={() => removeTeam(team)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTeams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Alert severity="info">No teams found for this view.</Alert>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {pending.length > 0 && (
          <Card sx={{ boxShadow: '0 8px 18px rgba(16, 36, 62, 0.08)' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Pending Queue
              </Typography>
              <Stack spacing={1.5}>
                {pending.map((item) => (
                  <Alert key={item.id} severity="warning">
                    <Typography fontWeight={700}>{item.topic}</Typography>
                    <Typography variant="body2">{item.reason}</Typography>
                  </Alert>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice('')} message={notice} />
      </Stack>
    </Box>
  );
}
