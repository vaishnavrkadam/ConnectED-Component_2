import { useMemo, useState } from 'react';
import {
  Alert,
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
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { BarChart, PieChart } from '@mui/x-charts';
import { useCollection } from '../hooks/useCollection.js';
import { deleteFaculty, facultyQuery, saveFaculty } from '../services/facultyService.js';
import { allTeamsQuery, manuallyAssignTeam, pendingAllocationsQuery, submitTeam } from '../services/teamService.js';
import { parseTeamsCsv } from '../utils/teamCsv.js';

const emptyFaculty = {
  facultyId: '',
  facultyName: '',
  expertise: [],
  maxTeams: 3,
  allocatedTeams: 0,
  email: '',
};

export default function AdminDashboard() {
  const [facultyForm, setFacultyForm] = useState(emptyFaculty);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const { data: faculty, loading: facultyLoading, error: facultyError } = useCollection(useMemo(() => facultyQuery(), []));
  const { data: teams, loading: teamsLoading } = useCollection(useMemo(() => allTeamsQuery(), []));
  const { data: pending } = useCollection(useMemo(() => pendingAllocationsQuery(), []));

  const visibleFaculty = faculty.filter((item) => {
    const text = `${item.facultyName} ${item.email} ${item.expertise?.join(' ')}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const stats = useMemo(() => {
    const allocated = teams.filter((team) => team.allocatedFaculty).length;
    return {
      totalTeams: teams.length,
      allocated,
      pending: teams.filter((team) => team.status === 'PENDING').length,
      capacity: faculty.reduce((sum, item) => sum + Number(item.maxTeams || 0), 0),
    };
  }, [teams, faculty]);

  const statusSeries = useMemo(() => {
    const counts = teams.reduce((acc, team) => {
      acc[team.status] = (acc[team.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([label, value], id) => ({ id, label, value }));
  }, [teams]);

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

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Admin Dashboard</Typography>
        <Typography color="text.secondary">Manage faculty, manual overrides, pending teams, and allocation analytics.</Typography>
      </Box>

      {(facultyLoading || teamsLoading) && <LinearProgress />}
      {facultyError && <Alert severity="error">{facultyError.message}</Alert>}

      <Grid container spacing={2}>
        {[
          ['Total teams', stats.totalTeams],
          ['Allocated', stats.allocated],
          ['Pending', stats.pending],
          ['Faculty capacity', stats.capacity],
        ].map(([label, value]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">{label}</Typography>
                <Typography variant="h4">{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Bulk Team Upload</Typography>
              <Typography color="text.secondary">
                Upload a CSV with student names and project topic. Each row is submitted and auto-allocated immediately.
              </Typography>
            </Box>
            <Button component="label" variant="contained" startIcon={<UploadFileIcon />} disabled={bulkUploading}>
              Upload CSV
              <input type="file" accept=".csv,text/csv" hidden onChange={handleTeamCsvUpload} />
            </Button>
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            Accepted topic headers: TOPIC, TOPIC NAME, PROJECT TOPIC, PROJECT TITLE. Accepted student headers: TEAM
            LEADER, STUDENT1-STUDENT5, MEMBER1-MEMBER5, STUDENTS, MEMBERS.
          </Alert>
          {bulkUploading && <LinearProgress sx={{ mt: 2 }} />}
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                  <Typography variant="h6">Faculty Management</Typography>
                  <TextField
                    label="Search faculty"
                    size="small"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </Stack>
                <Stack component="form" direction={{ xs: 'column', md: 'row' }} spacing={1.5} onSubmit={handleSaveFaculty}>
                  <TextField
                    label="Faculty ID"
                    size="small"
                    value={facultyForm.facultyId}
                    onChange={(event) => setFacultyForm((current) => ({ ...current, facultyId: event.target.value }))}
                    required
                  />
                  <TextField
                    label="Name"
                    size="small"
                    value={facultyForm.facultyName}
                    onChange={(event) => setFacultyForm((current) => ({ ...current, facultyName: event.target.value }))}
                    required
                  />
                  <TextField
                    label="Expertise"
                    size="small"
                    value={facultyForm.expertise.join(', ')}
                    onChange={(event) =>
                      setFacultyForm((current) => ({ ...current, expertise: event.target.value.split(',') }))
                    }
                    helperText="Comma separated"
                    required
                  />
                  <TextField
                    label="Max"
                    size="small"
                    type="number"
                    value={facultyForm.maxTeams}
                    onChange={(event) => setFacultyForm((current) => ({ ...current, maxTeams: event.target.value }))}
                    inputProps={{ min: 1 }}
                    required
                  />
                  <TextField
                    label="Email"
                    size="small"
                    type="email"
                    value={facultyForm.email}
                    onChange={(event) => setFacultyForm((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                  <Button type="submit" variant="contained" startIcon={editingId ? <SaveIcon /> : <AddIcon />}>
                    {editingId ? 'Save' : 'Add'}
                  </Button>
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Expertise</TableCell>
                      <TableCell>Load</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleFaculty.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography fontWeight={700}>{item.facultyName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.facultyId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {item.expertise?.map((skill) => (
                              <Chip key={skill} label={skill} size="small" sx={{ mb: 0.5 }} />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {item.allocatedTeams || 0}/{item.maxTeams}
                        </TableCell>
                        <TableCell>{item.email}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton onClick={() => editFaculty(item)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton color="error" onClick={() => deleteFaculty(item.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Faculty Workload
              </Typography>
              <BarChart
                height={280}
                xAxis={[{ scaleType: 'band', data: faculty.map((item) => item.facultyName) }]}
                series={[{ data: faculty.map((item) => Number(item.allocatedTeams || 0)), label: 'Allocated' }]}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Teams and Manual Overrides</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Topic</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Mentor</TableCell>
                      <TableCell>Manual assign</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teams.map((team) => (
                      <TableRow key={team.id}>
                        <TableCell>
                          <Typography fontWeight={700}>{team.topic}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {team.teamLeader} · {team.category}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={team.status} size="small" color={team.allocatedFaculty ? 'success' : 'warning'} />
                        </TableCell>
                        <TableCell>{team.allocatedFaculty?.facultyName || 'Unassigned'}</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>
                          <TextField
                            select
                            size="small"
                            fullWidth
                            label="Assign faculty"
                            value=""
                            onChange={(event) => assign(team, event.target.value)}
                          >
                            {faculty
                              .filter((item) => Number(item.allocatedTeams || 0) < Number(item.maxTeams || 0))
                              .map((item) => (
                              <MenuItem key={item.id} value={item.id}>
                                {item.facultyName}
                              </MenuItem>
                            ))}
                          </TextField>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Allocation Status
                </Typography>
                {statusSeries.length > 0 ? <PieChart height={230} series={[{ data: statusSeries }]} /> : <Alert>No teams yet.</Alert>}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Pending Queue
                </Typography>
                <Stack spacing={1.5}>
                  {pending.length === 0 && <Alert severity="success">No pending allocations.</Alert>}
                  {pending.map((item) => (
                    <Alert key={item.id} severity="warning">
                      <Typography fontWeight={700}>{item.topic}</Typography>
                      <Typography variant="body2">{item.reason}</Typography>
                    </Alert>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice('')} message={notice} />
    </Stack>
  );
}
