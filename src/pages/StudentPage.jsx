import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useCollection } from '../hooks/useCollection.js';
import { allocateTeamByExpertise, recentTeamsQuery, submitTeam } from '../services/teamService.js';
import { detectTopicCategory } from '../utils/categories.js';

const blankMembers = ['', '', '', ''];

export default function StudentPage() {
  const [form, setForm] = useState({ teamLeader: '', members: blankMembers, topic: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const queryRef = useMemo(() => recentTeamsQuery(), []);
  const { data: teams, loading, error } = useCollection(queryRef);
  const category = detectTopicCategory(form.topic);

  useEffect(() => {
    const submittedTeam = teams.find((team) => team.status === 'SUBMITTED' && team.topic);
    if (submittedTeam && !busy) {
      allocateTeamByExpertise(submittedTeam.id, submittedTeam.topic).catch((allocationError) => {
        setNotice(allocationError.message);
      });
    }
  }, [teams, busy]);

  const updateMember = (index, value) => {
    setForm((current) => ({
      ...current,
      members: current.members.map((member, memberIndex) => (memberIndex === index ? value : member)),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await submitTeam(form);
      setForm({ teamLeader: '', members: blankMembers, topic: '' });
      setNotice('Project submitted and mentor allocation started.');
    } catch (submitError) {
      setNotice(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Student Submission</Typography>
        <Typography color="text.secondary">Submit once as team leader. Earlier submissions are processed first.</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
                <TextField
                  label="Team leader name"
                  value={form.teamLeader}
                  onChange={(event) => setForm((current) => ({ ...current, teamLeader: event.target.value }))}
                  required
                />
                {form.members.map((member, index) => (
                  <TextField
                    key={index}
                    label={`Member ${index + 1}`}
                    value={member}
                    onChange={(event) => updateMember(index, event.target.value)}
                    required
                  />
                ))}
                <TextField
                  label="Project topic"
                  value={form.topic}
                  onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))}
                  multiline
                  minRows={4}
                  required
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Detected category
                  </Typography>
                  <Chip label={category} color={category === 'General' ? 'default' : 'primary'} size="small" />
                </Stack>
                <Button type="submit" variant="contained" size="large" startIcon={<SendIcon />} disabled={busy}>
                  Submit topic
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Allocation Result</Typography>
                {loading && <LinearProgress />}
                {error && <Alert severity="error">{error.message}</Alert>}
                {teams.length === 0 && !loading && <Alert severity="info">No submissions yet.</Alert>}
                {teams.map((team) => (
                  <Card key={team.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={1.25}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip label={team.status} color={team.status?.includes('ALLOCATED') ? 'success' : 'warning'} />
                          <Chip label={team.category || 'General'} variant="outlined" />
                          {team.similarityScore != null && (
                            <Chip label={`${Math.round(Math.min(team.similarityScore, 1) * 100)}% match`} variant="outlined" />
                          )}
                        </Stack>
                        <Typography fontWeight={700}>{team.topic}</Typography>
                        <Typography color="text.secondary">
                          {team.allocatedFaculty
                            ? `Allocated to ${team.allocatedFaculty.facultyName} (${team.allocatedFaculty.email})`
                            : 'Waiting for automatic or manual allocation.'}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice('')} message={notice} />
    </Stack>
  );
}
