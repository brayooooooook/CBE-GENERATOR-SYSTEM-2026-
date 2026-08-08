// @ts-nocheck
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str.trim());
}

const CLASS_STREAM_SEED_MAP: Record<string, { class_name: string; stream: string; education_level: string }> = {
  'cls_pp1_b': { class_name: 'PP1', stream: 'Blue', education_level: 'Pre-Primary' },
  'cls_pp2_b': { class_name: 'PP2', stream: 'Blue', education_level: 'Pre-Primary' },
  'cls_g1_b': { class_name: 'Grade 1', stream: 'Blue', education_level: 'Lower Primary' },
  'cls_g2_b': { class_name: 'Grade 2', stream: 'Blue', education_level: 'Lower Primary' },
  'cls_g3_b': { class_name: 'Grade 3', stream: 'Blue', education_level: 'Lower Primary' },
  'cls_g4_b': { class_name: 'Grade 4', stream: 'Blue', education_level: 'Upper Primary' },
  'cls_g5_b': { class_name: 'Grade 5', stream: 'Blue', education_level: 'Upper Primary' },
  'cls_g5_r': { class_name: 'Grade 5', stream: 'Red', education_level: 'Upper Primary' },
  'cls_g6_b': { class_name: 'Grade 6', stream: 'Blue', education_level: 'Upper Primary' },
  'cls_7e': { class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
  'cls_7w': { class_name: 'Grade 7', stream: 'West', education_level: 'Junior School' },
  'cls_8e': { class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
  'cls_8w': { class_name: 'Grade 8', stream: 'West', education_level: 'Junior School' },
  'cls_9a': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
  'cls_grade9': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
  'cls_grade9_alpha': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
};

const SUBJECT_SEED_MAP: Record<string, { subject_name: string; subject_code: string; education_level: string }> = {
  'sb_pp_lang': { subject_name: 'Language Activities', subject_code: 'LANG ACT', education_level: 'Pre-Primary' },
  'sb_pp_math': { subject_name: 'Mathematical Activities', subject_code: 'MATH ACT', education_level: 'Pre-Primary' },
  'sb_pp_env': { subject_name: 'Environmental Activities', subject_code: 'ENV ACT', education_level: 'Pre-Primary' },
  'sb_pp_psy': { subject_name: 'Psychomotor & Creative Activities', subject_code: 'PSYCH ACT', education_level: 'Pre-Primary' },
  'sb_pp_re': { subject_name: 'Christian Religious Education', subject_code: 'CRE', education_level: 'Pre-Primary' },
  'sb_lp_eng': { subject_name: 'English Language Activities', subject_code: 'ENG LP', education_level: 'Lower Primary' },
  'sb_lp_kis': { subject_name: 'Kiswahili Language Activities', subject_code: 'KIS LP', education_level: 'Lower Primary' },
  'sb_lp_mat': { subject_name: 'Mathematical Activities', subject_code: 'MAT LP', education_level: 'Lower Primary' },
  'sb_lp_env': { subject_name: 'Environmental Activities', subject_code: 'ENV LP', education_level: 'Lower Primary' },
  'sb_lp_hng': { subject_name: 'Hygiene and Nutrition', subject_code: 'HNG LP', education_level: 'Lower Primary' },
  'sb_lp_crt': { subject_name: 'Creative Activities', subject_code: 'CREAT LP', education_level: 'Lower Primary' },
  'sb_lp_re': { subject_name: 'Christian Religious Education', subject_code: 'CRE', education_level: 'Lower Primary' },
  'sb_up_eng': { subject_name: 'English Language', subject_code: 'ENG UP', education_level: 'Upper Primary' },
  'sb_up_kis': { subject_name: 'Kiswahili Language', subject_code: 'KIS UP', education_level: 'Upper Primary' },
  'sb_up_mat': { subject_name: 'Mathematics', subject_code: 'MAT UP', education_level: 'Upper Primary' },
  'sb_up_sci': { subject_name: 'Science and Technology', subject_code: 'SCI UP', education_level: 'Upper Primary' },
  'sb_up_agr': { subject_name: 'Agriculture & Nutrition', subject_code: 'AGR UP', education_level: 'Upper Primary' },
  'sb_up_sst': { subject_name: 'Social Studies', subject_code: 'SST UP', education_level: 'Upper Primary' },
  'sb_up_crt': { subject_name: 'Creative Arts', subject_code: 'CREAT UP', education_level: 'Upper Primary' },
  'sb_up_re': { subject_name: 'Christian Religious Education', subject_code: 'CRE', education_level: 'Upper Primary' },
  'sb_eng': { subject_name: 'English', subject_code: 'ENG', education_level: 'Junior School' },
  'sb_kis': { subject_name: 'Kiswahili', subject_code: 'KIS', education_level: 'Junior School' },
  'sb_mat': { subject_name: 'Mathematics', subject_code: 'MAT', education_level: 'Junior School' },
  'sb_sci': { subject_name: 'Integrated Science', subject_code: 'SCI', education_level: 'Junior School' },
  'sb_cas': { subject_name: 'Creative Arts and Sports', subject_code: 'CAS', education_level: 'Junior School' },
  'sb_sst': { subject_name: 'Social Studies', subject_code: 'SST', education_level: 'Junior School' },
  'sb_cre': { subject_name: 'Christian Religious Education', subject_code: 'CRE', education_level: 'Junior School' },
  'sb_agn': { subject_name: 'Agriculture and Nutrition', subject_code: 'AGN', education_level: 'Junior School' },
  'sb_pts': { subject_name: 'Pre-Technical Studies', subject_code: 'PRE TECH', education_level: 'Junior School' },
  'sb_hed': { subject_name: 'Health Education', subject_code: 'HED', education_level: 'Junior School' },
  'sb_bst': { subject_name: 'Business Studies', subject_code: 'BST', education_level: 'Junior School' },
  'sb_cs': { subject_name: 'Computer Science', subject_code: 'CS', education_level: 'Junior School' },
};

async function resolveAllocationUUIDs(supabaseAdmin: any, alloc: any) {
  let resolvedClassId: string | null = null;
  let resolvedStreamId: string | null = null;
  let resolvedSubjectId: string | null = null;

  // 1. Resolve Class & Stream
  const rawClassId = alloc.class_id || alloc.stream_id;
  if (isUUID(rawClassId)) {
    const { data: clsData } = await supabaseAdmin.from('classes').select('id').eq('id', rawClassId).maybeSingle();
    if (clsData) {
      resolvedClassId = clsData.id;
      if (isUUID(alloc.stream_id)) {
        const { data: strmData } = await supabaseAdmin
          .from('streams')
          .select('id')
          .eq('id', alloc.stream_id)
          .eq('class_id', resolvedClassId)
          .maybeSingle();
        if (strmData) {
          resolvedStreamId = strmData.id;
        } else {
          throw new Error(`Stream with ID "${alloc.stream_id}" does not exist under the specified class.`);
        }
      }
    } else {
      const { data: strmData } = await supabaseAdmin.from('streams').select('id, class_id').eq('id', rawClassId).maybeSingle();
      if (strmData) {
        resolvedStreamId = strmData.id;
        resolvedClassId = strmData.class_id;
      } else {
        throw new Error(`Class or stream with ID "${rawClassId}" could not be found.`);
      }
    }
  } else if (rawClassId) {
    const seedMeta = CLASS_STREAM_SEED_MAP[rawClassId] || {};
    let className = alloc.class_name || seedMeta.class_name;
    let streamName = alloc.stream || alloc.stream_name || seedMeta.stream;

    if (!className && typeof rawClassId === 'string') {
      if (!rawClassId.startsWith('cls_')) {
        className = rawClassId;
      } else {
        const clean = rawClassId.replace(/^cls_/, '').replace(/_/g, ' ');
        const match = clean.match(/(grade\s*\d+|pp\d+|playgroup)(\s+([a-z0-9]+))?/i);
        if (match) {
          className = match[1].replace(/grade\s*/i, 'Grade ').replace(/pp\s*/i, 'PP').trim();
          if (!streamName && match[3]) streamName = match[3];
        } else {
          className = clean;
        }
      }
    }

    if (!className) {
      throw new Error(`Unable to resolve class name for identifier "${rawClassId}".`);
    }

    const { data: matchingClasses, error: clsErr } = await supabaseAdmin
      .from('classes')
      .select('id, class_name')
      .ilike('class_name', className);

    if (clsErr) {
      throw new Error(`Database query error while resolving class "${className}": ${clsErr.message}`);
    }

    let targetClass = null;
    if (matchingClasses && matchingClasses.length === 1) {
      targetClass = matchingClasses[0];
    } else if (matchingClasses && matchingClasses.length > 1) {
      const exact = matchingClasses.find((c: any) => c.class_name === className);
      if (exact) targetClass = exact;
      else targetClass = matchingClasses[0];
    } else {
      const parseGradeLevel = (name: string): number => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      const { data: newClass, error: createClsErr } = await supabaseAdmin
        .from('classes')
        .insert([{ class_name: className, grade_level: parseGradeLevel(className), capacity: 40 }])
        .select()
        .single();

      if (createClsErr || !newClass) {
        throw new Error(`Class "${className}" could not be found or created in database: ${createClsErr?.message || 'Unknown error'}`);
      }
      targetClass = newClass;
    }

    resolvedClassId = targetClass.id;

    if (streamName) {
      const { data: matchingStreams, error: strmErr } = await supabaseAdmin
        .from('streams')
        .select('id, stream_name')
        .eq('class_id', resolvedClassId)
        .ilike('stream_name', streamName);

      if (strmErr) {
        throw new Error(`Database query error while resolving stream "${streamName}": ${strmErr.message}`);
      }

      if (matchingStreams && matchingStreams.length === 1) {
        resolvedStreamId = matchingStreams[0].id;
      } else if (matchingStreams && matchingStreams.length > 1) {
        const exactStrm = matchingStreams.find((s: any) => s.stream_name === streamName);
        if (exactStrm) resolvedStreamId = exactStrm.id;
        else resolvedStreamId = matchingStreams[0].id;
      } else {
        const { data: newStream, error: createStrmErr } = await supabaseAdmin
          .from('streams')
          .insert([{ class_id: resolvedClassId, stream_name: streamName, capacity: 40 }])
          .select()
          .single();

        if (createStrmErr || !newStream) {
          throw new Error(`Stream "${streamName}" could not be created under class "${className}": ${createStrmErr?.message || 'Unknown error'}`);
        }
        resolvedStreamId = newStream.id;
      }
    }
  }

  // 2. Resolve Subject
  const rawSubjectId = alloc.subject_id;
  if (isUUID(rawSubjectId)) {
    const { data: sbData } = await supabaseAdmin.from('subjects').select('id').eq('id', rawSubjectId).maybeSingle();
    if (sbData) {
      resolvedSubjectId = sbData.id;
    } else {
      throw new Error(`Subject with ID "${rawSubjectId}" could not be found.`);
    }
  } else if (rawSubjectId) {
    const seedSbMeta = SUBJECT_SEED_MAP[rawSubjectId] || {};
    const subjectCode = alloc.subject_code || seedSbMeta.subject_code;
    const subjectName = alloc.subject_name || seedSbMeta.subject_name || (typeof rawSubjectId === 'string' && !rawSubjectId.startsWith('sb_') ? rawSubjectId : rawSubjectId);
    const eduLevel = alloc.education_level || seedSbMeta.education_level;

    if (!subjectCode && !subjectName) {
      throw new Error(`Unable to resolve subject code or name for identifier "${rawSubjectId}".`);
    }

    let query = supabaseAdmin.from('subjects').select('*');
    if (subjectCode && subjectName) {
      query = query.or(`subject_code.eq.${subjectCode},subject_name.ilike.${subjectName}`);
    } else if (subjectCode) {
      query = query.eq('subject_code', subjectCode);
    } else {
      query = query.ilike('subject_name', subjectName);
    }

    const { data: matchingSubjects, error: sbErr } = await query;
    if (sbErr) {
      throw new Error(`Database query error while resolving subject: ${sbErr.message}`);
    }

    let targetSubject = null;
    if (matchingSubjects && matchingSubjects.length > 0) {
      if (matchingSubjects.length === 1) {
        targetSubject = matchingSubjects[0];
      } else {
        if (eduLevel) {
          const matchEdu = matchingSubjects.find((s: any) => s.education_level === eduLevel);
          if (matchEdu) targetSubject = matchEdu;
        }
        if (!targetSubject && subjectCode) {
          const exactCode = matchingSubjects.find((s: any) => s.subject_code === subjectCode);
          if (exactCode) targetSubject = exactCode;
        }
        if (!targetSubject) {
          targetSubject = matchingSubjects[0];
        }
      }
    } else {
      const finalSubjectName = subjectName || rawSubjectId;
      const finalSubjectCode = subjectCode || (subjectName ? subjectName.substring(0, 8).toUpperCase() : rawSubjectId.substring(0, 8).toUpperCase());
      const { data: newSubject, error: createSbErr } = await supabaseAdmin
        .from('subjects')
        .insert([{ subject_name: finalSubjectName, subject_code: finalSubjectCode, category: 'Core', learning_area: eduLevel || 'Grade 1–9' }])
        .select()
        .single();

      if (createSbErr || !newSubject) {
        throw new Error(`Subject "${finalSubjectName}" could not be created in database: ${createSbErr?.message || 'Unknown error'}`);
      }
      targetSubject = newSubject;
    }

    resolvedSubjectId = targetSubject.id;
  }

  if (!resolvedSubjectId) {
    throw new Error(`Teacher allocation could not be created because subject reference is invalid or missing.`);
  }

  return {
    class_id: resolvedClassId,
    stream_id: resolvedStreamId,
    subject_id: resolvedSubjectId
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/admin/create-teacher", async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { 
        adminId, 
        role, 
        name, 
        email, 
        phone, 
        tsc_number, 
        username, 
        status, 
        temporary_password,
        force_password_change,
        is_class_teacher,
        class_teacher_of_id
      } = req.body;

      // Map role to canonical database value ('admin' | 'class_teacher' | 'subject_teacher')
      const canonicalizeRole = (roleInput: string | null | undefined): 'admin' | 'class_teacher' | 'subject_teacher' => {
        if (!roleInput || typeof roleInput !== 'string') return 'class_teacher';
        const cleaned = roleInput.trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (cleaned === 'admin' || cleaned === 'administrator') return 'admin';
        if (cleaned === 'class_teacher' || cleaned === 'classteacher' || cleaned === 'class') return 'class_teacher';
        if (cleaned === 'subject_teacher' || cleaned === 'subjectteacher' || cleaned === 'subject') return 'subject_teacher';
        return 'class_teacher';
      };

      const dbRole = canonicalizeRole(role);
      const computedIsClassTeacher = typeof is_class_teacher === 'boolean' ? is_class_teacher : (dbRole === 'class_teacher');

      // Extract authentication token from Authorization header or request body
      let token: string | null = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
        token = req.body.token.trim();
      }

      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }

      // Verify the authentication token via Supabase Auth
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }

      const authenticatedUserId = authUserData.user.id;

      // Look up authoritative user record in public.users
      let adminUser: { id: string; role: string } | null = null;
      const { data: userById } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('id', authenticatedUserId)
        .maybeSingle();

      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin
          .from('users')
          .select('id, role')
          .eq('email', authUserData.user.email.toLowerCase())
          .maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }

      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }

      if (adminUser.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden: Only administrators can create accounts." });
      }

      // 1. Create account in Supabase Auth securely
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: temporary_password,
        email_confirm: true,
        user_metadata: {
          role: dbRole,
          name: name,
          phone: phone,
          tsc_number: tsc_number,
          username: username,
          status: status,
          force_password_change: force_password_change,
        }
      });

      if (authError) {
        if (authError.message.includes('User already registered') || authError.message.includes('already exists') || authError.message.includes('already been registered')) {
            return res.status(400).json({ error: 'A user account with this email address has already been registered.' });
        }
        return res.status(400).json({ error: authError.message });
      }

      const authUserId = authData.user.id;

      // 2. Create the users record FIRST (because teachers.user_id references users.id)
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .insert([{
          id: authUserId, // Matches the auth user ID
          name: name,
          email: email,
          role: dbRole,
          teacher_id: null,
          student_id: null
        }])
        .select()
        .single();

      if (userError) {
        console.error('Database user creation error:', userError);
        // Rollback
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        if (userError.message && userError.message.includes('users_role_check')) {
          return res.status(400).json({ error: 'Failed to create user account: Invalid role specified. Please select a valid role (Class Teacher, Subject Teacher, or Administrator).' });
        }
        return res.status(400).json({ error: `Failed to create application user: ${userError.message}` });
      }

      // Restore the frontend role so the UI behaves correctly
      userData.role = dbRole;

      // 3. Create or link the teacher profile
      const { data: existingTeacher } = await supabaseAdmin
        .from('teachers')
        .select('*')
        .ilike('email', email.trim().toLowerCase())
        .maybeSingle();

      let teacherData: any = null;
      let isExistingTeacher = false;

      if (existingTeacher) {
        isExistingTeacher = true;
        // Safe Administrative Repair Path: Link existing teacher profile to the new Supabase Auth user_id
        const { data: updatedTeacher, error: updateTErr } = await supabaseAdmin
          .from('teachers')
          .update({
            user_id: authUserId,
            teacher_name: name || existingTeacher.teacher_name,
            phone: phone || existingTeacher.phone,
            tsc_number: tsc_number || existingTeacher.tsc_number,
            is_class_teacher: computedIsClassTeacher
          })
          .eq('id', existingTeacher.id)
          .select()
          .single();

        if (updateTErr) {
          console.error('Database teacher profile update/link error:', updateTErr);
          // Rollback users and auth
          await supabaseAdmin.from('users').delete().eq('id', authUserId);
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          return res.status(400).json({ error: `Failed to link teacher profile: ${updateTErr.message}` });
        }
        teacherData = updatedTeacher;
      } else {
        // Insert new teacher profile (letting PostgreSQL/Supabase generate the teacher UUID)
        const { data: newTeacher, error: teacherError } = await supabaseAdmin
          .from('teachers')
          .insert([{
            user_id: authUserId,
            teacher_name: name,
            tsc_number: tsc_number || null,
            phone: phone || null,
            email: email,
            is_class_teacher: computedIsClassTeacher
          }])
          .select()
          .single();

        if (teacherError) {
          console.error('Database teacher profile creation error:', teacherError);
          // Rollback users and auth
          await supabaseAdmin.from('users').delete().eq('id', authUserId);
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          return res.status(400).json({ error: `Failed to create teacher profile: ${teacherError.message}` });
        }
        teacherData = newTeacher;
      }

      // 4. Update the users record with teacher_id
      await supabaseAdmin
        .from('users')
        .update({ teacher_id: teacherData.id })
        .eq('id', authUserId);
      
      userData.teacher_id = teacherData.id;

      // Update streams.class_teacher_id if class_teacher_of_id is provided
      if (computedIsClassTeacher && class_teacher_of_id) {
        try {
          if (isUUID(class_teacher_of_id)) {
            await supabaseAdmin
              .from('streams')
              .update({ class_teacher_id: teacherData.id })
              .eq('id', class_teacher_of_id);
          }
        } catch (strmErr) {
          console.warn('Could not update streams.class_teacher_id:', strmErr);
        }
      }

      // 5. Create allocations with verified database UUIDs
      const allocations = req.body.allocations || [];
      if (allocations.length > 0) {
        const allocationInserts = [];
        for (const alloc of allocations) {
          try {
            const resolved = await resolveAllocationUUIDs(supabaseAdmin, alloc);
            const item: any = {
              teacher_id: teacherData.id,
              subject_id: resolved.subject_id
            };
            if (resolved.class_id) item.class_id = resolved.class_id;
            if (resolved.stream_id) item.stream_id = resolved.stream_id;
            allocationInserts.push(item);
          } catch (resErr: any) {
            console.error(`Allocation resolution failed for alloc:`, alloc, resErr.message);
            // Roll back created/updated teacher profile, user record, and auth account
            if (isExistingTeacher) {
              await supabaseAdmin.from('teachers').update({ user_id: null }).eq('id', teacherData.id);
            } else {
              await supabaseAdmin.from('teachers').delete().eq('id', teacherData.id);
            }
            await supabaseAdmin.from('users').delete().eq('id', authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return res.status(400).json({
              error: `Teacher allocation could not be created: ${resErr.message}`
            });
          }
        }

        if (allocationInserts.length > 0) {
          const { error: allocError } = await supabaseAdmin
            .from('teacher_subjects')
            .insert(allocationInserts);

          if (allocError) {
            console.error('Failed to create teacher allocations in teacher_subjects:', allocError);
            // Roll back created/updated teacher profile, user record, and auth account
            if (isExistingTeacher) {
              await supabaseAdmin.from('teachers').update({ user_id: null }).eq('id', teacherData.id);
            } else {
              await supabaseAdmin.from('teachers').delete().eq('id', teacherData.id);
            }
            await supabaseAdmin.from('users').delete().eq('id', authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return res.status(400).json({
              error: `Failed to save teacher allocations: ${allocError.message}`
            });
          }
        }
      }

      return res.status(200).json({
        user: userData,
        teacher: teacherData
      });

    } catch (err: any) {
      console.error('Error in /api/admin/create-teacher:', err);
      return res.status(500).json({ error: 'Internal server error during account creation.' });
    }
  });

  // Admin Update Teacher Handler
  const updateTeacherHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Extract authentication token from Authorization header or request body
      let token: string | null = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
        token = req.body.token.trim();
      }

      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }

      // Verify authentication token via Supabase Auth
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }

      const authenticatedUserId = authUserData.user.id;

      // Look up authoritative user record in public.users
      let adminUser: { id: string; role: string } | null = null;
      const { data: userById } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('id', authenticatedUserId)
        .maybeSingle();

      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin
          .from('users')
          .select('id, role')
          .eq('email', authUserData.user.email.toLowerCase())
          .maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }

      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }

      if (adminUser.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden: Only administrators can update teacher accounts." });
      }

      const { teacher } = req.body || {};
      if (!teacher) {
        return res.status(400).json({ error: "Teacher object is required." });
      }

      const teacherIdInput = teacher.id;
      const targetEmail = teacher.email ? teacher.email.trim().toLowerCase() : '';

      // Find teacher in public.teachers
      let targetTeacherId = isUUID(teacherIdInput) ? teacherIdInput : null;
      if (!targetTeacherId) {
        if (targetEmail) {
          const { data: tByEmail } = await supabaseAdmin.from('teachers').select('id').eq('email', targetEmail).maybeSingle();
          if (tByEmail) targetTeacherId = tByEmail.id;
        }
        if (!targetTeacherId && teacherIdInput) {
          const { data: tById } = await supabaseAdmin.from('teachers').select('id').eq('id', teacherIdInput).maybeSingle();
          if (tById) targetTeacherId = tById.id;
        }
      }

      if (!targetTeacherId) {
        return res.status(404).json({ error: "Teacher record not found in database." });
      }

      // Update primary teacher record
      const isClassTeacher = Boolean(teacher.is_class_teacher);
      const { data: updatedTeacher, error: updateTErr } = await supabaseAdmin
        .from('teachers')
        .update({
          teacher_name: teacher.teacher_name,
          email: teacher.email,
          phone: teacher.phone || null,
          tsc_number: teacher.tsc_number || null,
          is_class_teacher: isClassTeacher,
        })
        .eq('id', targetTeacherId)
        .select()
        .maybeSingle();

      if (updateTErr) {
        console.error('Error updating teacher in DB:', updateTErr);
        return res.status(400).json({ error: `Failed to update teacher: ${updateTErr.message}` });
      }

      // Update public.users record
      if (targetEmail) {
        await supabaseAdmin.from('users').update({
          name: teacher.teacher_name,
          email: teacher.email,
          role: isClassTeacher ? 'class_teacher' : 'subject_teacher',
        }).or(`teacher_id.eq.${targetTeacherId},email.eq.${targetEmail}`);
      }

      // Handle stream assignment
      await supabaseAdmin.from('streams').update({ class_teacher_id: null }).eq('class_teacher_id', targetTeacherId);

      if (isClassTeacher && teacher.class_teacher_of_id && isUUID(teacher.class_teacher_of_id)) {
        await supabaseAdmin.from('streams').update({ class_teacher_id: targetTeacherId }).eq('id', teacher.class_teacher_of_id);
      }

      // Handle teacher_subjects allocations atomically via PostgreSQL RPC
      const allocations = teacher.allocations || [];
      const rawInserts: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }> = [];
      for (const alloc of allocations) {
        try {
          const resolved = await resolveAllocationUUIDs(supabaseAdmin, alloc);
          if (resolved.subject_id) {
            rawInserts.push({
              subject_id: resolved.subject_id,
              class_id: resolved.class_id || null,
              stream_id: resolved.stream_id || null,
            });
          }
        } catch (resErr: any) {
          console.warn(`Allocation resolution warning during update:`, resErr.message);
          return res.status(400).json({ error: `Failed to resolve allocation: ${resErr.message}` });
        }
      }

      const seenKeys = new Set<string>();
      const allocPayload: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }> = [];
      for (const item of rawInserts) {
        const key = `${item.subject_id}_${item.class_id || 'null'}_${item.stream_id || 'null'}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allocPayload.push(item);
        }
      }

      const { data: rpcAllocRes, error: rpcAllocErr } = await supabaseAdmin.rpc('update_teacher_allocations_atomic', {
        p_teacher_id: targetTeacherId,
        p_allocations: allocPayload,
      });

      if (rpcAllocErr) {
        // Fallback for environment where RPC is not registered in schema cache
        if (rpcAllocErr.code === 'PGRST202') {
          const { data: existingAllocs } = await supabaseAdmin
            .from('teacher_subjects')
            .select('subject_id, class_id, stream_id')
            .eq('teacher_id', targetTeacherId);

          const { error: delAllocErr } = await supabaseAdmin.from('teacher_subjects').delete().eq('teacher_id', targetTeacherId);
          if (delAllocErr) {
            console.error('Error clearing old allocations in fallback:', delAllocErr);
            return res.status(400).json({ error: `Failed to update allocations: ${delAllocErr.message}` });
          }

          if (allocPayload.length > 0) {
            const inserts = allocPayload.map((a) => ({ teacher_id: targetTeacherId, ...a }));
            const { error: insAllocErr } = await supabaseAdmin.from('teacher_subjects').insert(inserts);
            if (insAllocErr) {
              console.error('Failed to insert new allocations in fallback, restoring original allocations:', insAllocErr);
              if (existingAllocs && existingAllocs.length > 0) {
                await supabaseAdmin
                  .from('teacher_subjects')
                  .insert(existingAllocs.map((a: any) => ({ teacher_id: targetTeacherId, ...a })));
              }
              return res.status(400).json({ error: `Failed to save teacher allocations: ${insAllocErr.message}` });
            }
          }
        } else {
          console.error('RPC update_teacher_allocations_atomic failed:', rpcAllocErr);
          return res.status(400).json({ error: `Failed to update teacher allocations: ${rpcAllocErr.message}` });
        }
      }

      return res.status(200).json({
        success: true,
        teacher: updatedTeacher
      });
    } catch (err: any) {
      console.error('Error in /api/admin/update-teacher:', err);
      return res.status(500).json({ error: 'Internal server error during teacher update.' });
    }
  };

  app.post('/api/admin/update-teacher', updateTeacherHandler);
  app.put('/api/admin/update-teacher', updateTeacherHandler);

  // Admin Delete Teacher Handler
  const deleteTeacherHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { teacherId, email, userId } = req.body || {};

      // Extract authentication token
      let token: string | null = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
        token = req.body.token.trim();
      }

      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }

      // Verify authentication token via Supabase Auth
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }

      const authenticatedUserId = authUserData.user.id;
      let adminUser: { id: string; role: string } | null = null;

      const { data: userById } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('id', authenticatedUserId)
        .maybeSingle();

      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin
          .from('users')
          .select('id, role')
          .eq('email', authUserData.user.email.toLowerCase())
          .maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }

      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }

      if (adminUser.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden: Only administrators can delete teacher accounts." });
      }

      const cleanTeacherId = teacherId ? String(teacherId).trim() : null;
      const cleanUserId = userId ? String(userId).trim() : null;
      const cleanEmail = email ? String(email).trim().toLowerCase() : null;

      if (!cleanTeacherId && !cleanUserId && !cleanEmail) {
        return res.status(400).json({ error: "Missing teacher identifier: teacherId, userId, or email required." });
      }

      let resolvedTeacherId = cleanTeacherId;
      let resolvedUserId = cleanUserId;
      let resolvedEmail = cleanEmail;
      let isAlreadyDeleted = false;

      // 1. Enforce Atomic DB Deletion via PostgreSQL RPC function
      let rpcRes: any = null;
      let rpcErr: any = null;

      const rpcCall = await supabaseAdmin.rpc('delete_teacher_atomic', {
        p_teacher_id: cleanTeacherId,
        p_user_id: cleanUserId,
        p_email: cleanEmail,
      });

      rpcRes = rpcCall.data;
      rpcErr = rpcCall.error;

      if (rpcErr) {
        if (rpcErr.code === 'PGRST202') {
          console.warn('RPC delete_teacher_atomic not found in schema cache (PGRST202). Executing direct database fallback deletion.');

          let foundTeacherId: string | null = cleanTeacherId;
          let foundUserId: string | null = cleanUserId;
          let foundEmail: string | null = cleanEmail;

          // Lookup teacher record
          if (cleanTeacherId) {
            const { data: t } = await supabaseAdmin.from('teachers').select('id, user_id, email').eq('id', cleanTeacherId).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          } else if (cleanEmail) {
            const { data: t } = await supabaseAdmin.from('teachers').select('id, user_id, email').ilike('email', cleanEmail).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          } else if (cleanUserId) {
            const { data: t } = await supabaseAdmin.from('teachers').select('id, user_id, email').eq('user_id', cleanUserId).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          }

          // Lookup user record
          if (!foundUserId && foundTeacherId) {
            const { data: u } = await supabaseAdmin.from('users').select('id, email').eq('teacher_id', foundTeacherId).maybeSingle();
            if (u) {
              foundUserId = u.id;
              if (u.email && !foundEmail) foundEmail = u.email.toLowerCase();
            }
          }
          if (!foundUserId && cleanUserId) {
            const { data: u } = await supabaseAdmin.from('users').select('id, email').eq('id', cleanUserId).maybeSingle();
            if (u) {
              foundUserId = u.id;
              if (u.email && !foundEmail) foundEmail = u.email.toLowerCase();
            }
          }
          if (!foundUserId && foundEmail) {
            const { data: u } = await supabaseAdmin.from('users').select('id, email').ilike('email', foundEmail).maybeSingle();
            if (u) {
              foundUserId = u.id;
            }
          }

          if (!foundTeacherId && !foundUserId) {
            rpcRes = {
              success: true,
              already_deleted: true,
              teacher_id: cleanTeacherId,
              user_id: cleanUserId,
              email: cleanEmail
            };
          } else {
            // Delete allocations & clear class teacher references
            if (foundTeacherId) {
              await supabaseAdmin.from('teacher_subjects').delete().eq('teacher_id', foundTeacherId);
              await supabaseAdmin.from('streams').update({ class_teacher_id: null }).eq('class_teacher_id', foundTeacherId);
              await supabaseAdmin.from('classes').update({ class_teacher_id: null }).eq('class_teacher_id', foundTeacherId);
              await supabaseAdmin.from('teachers').delete().eq('id', foundTeacherId);
            }
            if (foundEmail) {
              await supabaseAdmin.from('teachers').delete().ilike('email', foundEmail);
            }

            // Delete user records
            if (foundUserId) {
              await supabaseAdmin.from('users').delete().eq('id', foundUserId);
            }
            if (foundTeacherId) {
              await supabaseAdmin.from('users').delete().eq('teacher_id', foundTeacherId);
            }
            if (foundEmail) {
              await supabaseAdmin.from('users').delete().ilike('email', foundEmail);
            }

            rpcRes = {
              success: true,
              already_deleted: false,
              teacher_id: foundTeacherId || cleanTeacherId,
              user_id: foundUserId || cleanUserId,
              email: foundEmail || cleanEmail
            };
          }
        } else {
          console.error('RPC delete_teacher_atomic failed:', rpcErr);
          return res.status(500).json({
            error: `Database atomic teacher deletion failed: ${rpcErr.message || 'RPC execution error'}`
          });
        }
      }

      if (!rpcRes || typeof rpcRes !== 'object') {
        return res.status(500).json({ error: 'Database atomic teacher deletion failed: Invalid response from RPC function.' });
      }

      if (!rpcRes.success) {
        return res.status(500).json({ error: rpcRes.error || 'Database atomic teacher deletion failed.' });
      }

      isAlreadyDeleted = !!rpcRes.already_deleted;
      if (rpcRes.teacher_id) resolvedTeacherId = String(rpcRes.teacher_id);
      if (rpcRes.user_id) resolvedUserId = String(rpcRes.user_id);
      if (rpcRes.email) resolvedEmail = String(rpcRes.email).toLowerCase();

      // 2. Server-side Supabase Auth user deletion
      let authDeleteSuccess = false;
      let authDeleteErrorMsg: string | null = null;

      const candidateAuthUuids = new Set<string>();
      if (resolvedUserId && isUUID(resolvedUserId)) candidateAuthUuids.add(resolvedUserId);
      if (cleanUserId && isUUID(cleanUserId)) candidateAuthUuids.add(cleanUserId);
      if (resolvedTeacherId && isUUID(resolvedTeacherId)) candidateAuthUuids.add(resolvedTeacherId);
      if (cleanTeacherId && isUUID(cleanTeacherId)) candidateAuthUuids.add(cleanTeacherId);

      const targetEmail = (resolvedEmail || cleanEmail || '').toLowerCase().trim();

      if (candidateAuthUuids.size > 0) {
        for (const authUuid of candidateAuthUuids) {
          try {
            const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(authUuid);
            if (!authErr) {
              authDeleteSuccess = true;
            } else if (authErr.message?.toLowerCase().includes('not found') || authErr.status === 404) {
              authDeleteSuccess = true; // Idempotent: User already removed from Auth
            } else {
              authDeleteErrorMsg = authErr.message;
            }
          } catch (err: any) {
            authDeleteErrorMsg = err?.message || 'Auth deletion exception';
          }
        }
      }

      if (!authDeleteSuccess && targetEmail) {
        try {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const matchAuth = listData?.users?.find(u => u.email?.toLowerCase() === targetEmail);
          if (matchAuth) {
            const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(matchAuth.id);
            if (!authErr || authErr.message?.toLowerCase().includes('not found') || authErr.status === 404) {
              authDeleteSuccess = true;
            } else {
              authDeleteErrorMsg = authErr.message;
            }
          } else {
            authDeleteSuccess = true; // User not found in Auth list
          }
        } catch (err: any) {
          authDeleteErrorMsg = err?.message || 'Auth list/delete exception';
        }
      }

      if (candidateAuthUuids.size === 0 && !targetEmail) {
        authDeleteSuccess = true;
      }

      if (!authDeleteSuccess && authDeleteErrorMsg) {
        console.error(`Teacher DB deletion succeeded, but Supabase Auth account deletion failed for teacher_id: ${resolvedTeacherId || cleanTeacherId}, user_id: ${resolvedUserId || cleanUserId}, email: ${targetEmail || cleanEmail}. Error: ${authDeleteErrorMsg}`);
        return res.status(500).json({
          error: `Database records cleared, but failed to delete Supabase Auth account: ${authDeleteErrorMsg}`,
          database_deleted: true,
          auth_deleted: false,
          cleanup_required: true,
          teacher_id: resolvedTeacherId || cleanTeacherId,
          user_id: resolvedUserId || cleanUserId,
          email: targetEmail || cleanEmail
        });
      }

      return res.status(200).json({
        success: true,
        database_deleted: true,
        auth_deleted: true,
        already_deleted: isAlreadyDeleted,
        message: isAlreadyDeleted
          ? 'Teacher account was already deleted or does not exist.'
          : 'Teacher and associated records deleted successfully.'
      });

    } catch (err: any) {
      console.error('Error in /api/admin/delete-teacher:', err);
      return res.status(500).json({ error: 'Internal server error during teacher deletion.' });
    }
  };

  app.post('/api/admin/delete-teacher', deleteTeacherHandler);
  app.delete('/api/admin/delete-teacher', deleteTeacherHandler);

  // Admin Reset Password Handler
  const resetPasswordHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { emailOrUserId, newPassword, forcePasswordChange = true, email, teacherId, userId } = req.body || {};

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: "Invalid password: Must be at least 6 characters long." });
      }

      // Extract authentication token
      let token: string | null = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
        token = req.body.token.trim();
      }

      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }

      // Verify authentication token via Supabase Auth
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }

      const authenticatedUserId = authUserData.user.id;

      // Verify caller is an administrator in public.users or public.teachers
      let isAdmin = false;
      const { data: callerUser } = await supabaseAdmin.from('users').select('role').eq('id', authenticatedUserId).maybeSingle();
      if (callerUser && (callerUser.role === 'admin' || callerUser.role === 'administrator')) {
        isAdmin = true;
      } else {
        const { data: callerTeacher } = await supabaseAdmin.from('teachers').select('role').eq('user_id', authenticatedUserId).maybeSingle();
        if (callerTeacher && (callerTeacher.role === 'admin' || callerTeacher.role === 'administrator')) {
          isAdmin = true;
        }
      }

      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Only administrators can reset user passwords." });
      }

      // Target Auth User Resolution
      let targetAuthUserId: string | null = null;
      const cleanTarget = (emailOrUserId || email || '').trim().toLowerCase();

      if (userId && isUUID(userId)) {
        targetAuthUserId = userId;
      } else if (teacherId) {
        const { data: tRow } = await supabaseAdmin.from('teachers').select('user_id').eq('id', teacherId).maybeSingle();
        if (tRow?.user_id) {
          targetAuthUserId = tRow.user_id;
        }
      }

      if (!targetAuthUserId && cleanTarget) {
        // Try looking up in public.users by email
        const { data: uRow } = await supabaseAdmin.from('users').select('id').eq('email', cleanTarget).maybeSingle();
        if (uRow?.id) {
          targetAuthUserId = uRow.id;
        }
      }

      if (!targetAuthUserId && cleanTarget) {
        // Try looking up in public.teachers by email
        const { data: tRow } = await supabaseAdmin.from('teachers').select('user_id').eq('email', cleanTarget).maybeSingle();
        if (tRow?.user_id) {
          targetAuthUserId = tRow.user_id;
        }
      }

      if (!targetAuthUserId && cleanTarget) {
        // Search directly in Auth users list by email
        try {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const matchAuth = listData?.users?.find(u => u.email?.toLowerCase() === cleanTarget);
          if (matchAuth) {
            targetAuthUserId = matchAuth.id;
          }
        } catch (lErr) {
          console.warn('Error searching Auth users by email:', lErr);
        }
      }

      if (!targetAuthUserId) {
        return res.status(404).json({ error: "Target user account not found in Supabase Auth." });
      }

      // Execute authoritative password reset in Supabase Auth
      const { data: updateRes, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetAuthUserId,
        {
          password: newPassword,
          user_metadata: { force_password_change: !!forcePasswordChange }
        }
      );

      if (updateError) {
        console.error('Supabase Auth updateUserById error:', updateError);
        return res.status(500).json({ error: `Supabase Auth error: ${updateError.message}` });
      }

      // Update force_password_change flag in public.users and public.teachers without storing plain password
      await supabaseAdmin.from('users').update({
        force_password_change: !!forcePasswordChange,
        temporary_password: null
      }).eq('id', targetAuthUserId);

      if (cleanTarget) {
        await supabaseAdmin.from('teachers').update({
          force_password_change: !!forcePasswordChange,
          temporary_password: null
        }).eq('email', cleanTarget);
      }

      return res.status(200).json({
        success: true,
        message: 'Password updated successfully in Supabase Auth.',
        targetAuthUserId
      });

    } catch (err: any) {
      console.error('Error in /api/admin/reset-password:', err);
      return res.status(500).json({ error: 'Internal server error during password reset.' });
    }
  };

  app.post('/api/admin/reset-password', resetPasswordHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
