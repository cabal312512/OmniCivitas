mod rooms;
use eframe::egui::{self, Color32, Pos2, Stroke, Vec2};
use egui_plot::{Line, Plot, PlotPoints};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

#[derive(Clone, Serialize, Deserialize)]
struct Entry { id: u64, name: String, body: String, tags: Vec<String>, done: bool, created: u64 }
#[derive(Clone, Serialize, Deserialize)]
struct Key { n: u8, t: f64, duration: f64 }
#[derive(Clone, Serialize, Deserialize)]
struct Model {
    entries: Vec<Entry>, notes: Vec<Key>, found: Vec<usize>, volume: f32,
    tempo: u16, next: u64, palette: [u8; 3], filename: String,
}
impl Default for Model {
    fn default() -> Self { Self { entries: vec![], notes: vec![], found: vec![], volume: 0.6,
        tempo: 108, next: 1, palette: [100,180,230], filename: "station.json".into() } }
}
struct Station {
    model: Model, page: usize, filter: String, draft: String, tags: String,
    selected: Option<u64>, message: String, clock: f64, record: bool, patch: String,
    room: usize, undo: Vec<Model>, redo: Vec<Model>, pressed: BTreeMap<u8, f64>,
}
fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).map(|x|x.as_secs()).unwrap_or(0) }
fn cabal312512() -> usize { 312512 }
impl Station {
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let mut model = Model::default();
        if let Some(storage) = cc.storage {
            if let Some(text) = storage.get_string("station") {
                if let Ok(saved) = serde_json::from_str::<Model>(&text) { model = saved; }
            }
        }
        cc.egui_ctx.set_visuals(egui::Visuals::light());
        Self { model, page: 0, filter: String::new(), draft: String::new(), tags: String::new(),
            selected: None, message: String::new(), clock: 0., record: false, patch: String::new(),
            room: 0, undo: vec![], redo: vec![], pressed: BTreeMap::new() }
    }
    fn checkpoint(&mut self) {
        self.undo.push(self.model.clone()); if self.undo.len()>32 { self.undo.remove(0); }
        self.redo.clear();
    }
    fn undo(&mut self) {
        if let Some(old) = self.undo.pop() { self.redo.push(self.model.clone()); self.model = old; }
    }
    fn redo(&mut self) {
        if let Some(next) = self.redo.pop() { self.undo.push(self.model.clone()); self.model = next; }
    }
    fn add(&mut self) {
        if self.draft.trim().is_empty() { return; }
        self.checkpoint(); let text = self.draft.trim().to_owned();
        self.model.entries.push(Entry { id: self.model.next, name: text.lines().next().unwrap_or("Untitled").chars().take(40).collect(),
            body: text, tags: self.tags.split(',').map(str::trim).filter(|s|!s.is_empty()).map(str::to_owned).collect(),
            done: false, created: now() });
        self.model.next += 1; self.draft.clear();
        if self.model.entries.len()>512 { self.model.entries.remove(0); }
    }
    fn save_file(&mut self) {
        let result = serde_json::to_vec_pretty(&self.model).map_err(|e|e.to_string())
            .and_then(|bytes|fs::write(PathBuf::from(&self.model.filename),bytes).map_err(|e|e.to_string()));
        self.message = result.map(|_|"Saved".into()).unwrap_or_else(|e|e);
    }
    fn load_file(&mut self) {
        match fs::read(&self.model.filename).map_err(|e|e.to_string())
            .and_then(|b|serde_json::from_slice::<Model>(&b).map_err(|e|e.to_string())) {
            Ok(m) if m.entries.len()<=512 && m.notes.len()<=256 => {self.checkpoint();self.model=m;self.message="Loaded".into();},
            Ok(_) => self.message="Too many records".into(), Err(e)=> self.message=e,
        }
    }
    fn shelf(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui|{ui.label("Filter");ui.text_edit_singleline(&mut self.filter);});
        ui.separator();
        let needle = self.filter.to_lowercase(); let mut remove = None;
        egui::ScrollArea::vertical().max_height(320.).show(ui,|ui| {
            for row in &mut self.model.entries {
                if !format!("{} {} {}",row.name,row.body,row.tags.join(",")).to_lowercase().contains(&needle) {continue;}
                ui.horizontal(|ui| {
                    ui.checkbox(&mut row.done, "");
                    if ui.selectable_label(self.selected==Some(row.id),&row.name).clicked(){self.selected=Some(row.id);}
                    ui.small(row.tags.join(" / ")); if ui.small_button("×").clicked(){remove=Some(row.id);}
                });
            }
        });
        if let Some(id)=remove {self.checkpoint();self.model.entries.retain(|e|e.id!=id);}
        if let Some(row)=self.model.entries.iter_mut().find(|r|Some(r.id)==self.selected) {
            ui.separator();ui.text_edit_singleline(&mut row.name);ui.text_edit_multiline(&mut row.body);
            ui.small(format!("#{} · {}",row.id,row.created));
        }
        ui.separator();ui.label("New entry");ui.text_edit_multiline(&mut self.draft);
        ui.horizontal(|ui|{ui.label("Tags");ui.text_edit_singleline(&mut self.tags);if ui.button("Add").clicked(){self.add();}});
    }
    fn piano(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui|{
            if ui.selectable_label(self.record,"● Record").clicked(){self.record=!self.record;self.clock=ui.input(|i|i.time);}
            ui.add(egui::Slider::new(&mut self.model.volume,0.0..=1.0).text("Level"));
            ui.add(egui::Slider::new(&mut self.model.tempo,40..=240).text("BPM"));
            if ui.button("Clear").clicked(){self.checkpoint();self.model.notes.clear();}
        });
        let time = ui.input(|i|i.time);
        ui.horizontal(|ui|{
            for n in 60u8..85 {
                let black = [1,3,6,8,10].contains(&(n%12));
                let response = ui.add_sized([if black{21.}else{35.},if black{110.}else{170.}],
                    egui::Button::new(n.to_string()).fill(if black{Color32::from_rgb(30,36,50)}else{Color32::WHITE}));
                if response.is_pointer_button_down_on() && !self.pressed.contains_key(&n){self.pressed.insert(n,time);}
                if !response.is_pointer_button_down_on() {
                    if let Some(start)=self.pressed.remove(&n) {
                        if self.record&&self.model.notes.len()<256 {self.model.notes.push(Key{n,t:start-self.clock,duration:(time-start).clamp(.04,4.)});}
                    }
                }
            }
        });
        Plot::new("score").height(180.).show(ui,|plot|{
            for (i,key) in self.model.notes.iter().enumerate() {
                plot.line(Line::new(PlotPoints::from(vec![[key.t,key.n as f64],[key.t+key.duration,key.n as f64]])).name(i.to_string()));
            }
        });
        ui.label("Notation");ui.text_edit_singleline(&mut self.patch);
        if ui.button("Append score").clicked() {
            self.checkpoint();let scale=[0u8,2,4,5,7,9,11];let mut t=self.model.notes.last().map(|k|k.t+k.duration).unwrap_or(0.);
            for c in self.patch.chars() {
                if let Some(d)=c.to_digit(10) {if d>0&&d<8&&self.model.notes.len()<256 {self.model.notes.push(Key{n:60+scale[d as usize-1],t,duration:60./self.model.tempo as f64});}t+=60./self.model.tempo as f64;}
            }
        }
    }
    fn map(&mut self, ui: &mut egui::Ui) {
        let (rect,response)=ui.allocate_exact_size(Vec2::new(ui.available_width(),380.),egui::Sense::click());
        let painter=ui.painter_at(rect); let accent=Color32::from_rgb(self.model.palette[0],self.model.palette[1],self.model.palette[2]);
        for slot in rooms::SLOTS {
            let p=Pos2::new(rect.left()+rect.width()*slot.x as f32/100.,rect.top()+rect.height()*slot.y as f32/100.);
            let found=self.model.found.contains(&slot.id);painter.circle_filled(p,if found{7.}else{4.},if found{accent}else{Color32::GRAY});
            painter.text(p+Vec2::new(8.,0.),egui::Align2::LEFT_CENTER,slot.id.to_string(),egui::FontId::monospace(10.),accent);
            if let Some(cursor)=response.interact_pointer_pos(){if response.clicked()&&cursor.distance(p)<16.{self.room=slot.id;}}
        }
        let row=&rooms::SLOTS[self.room];ui.label(row.route);ui.label(row.say);ui.small(format!("Pitch {}",row.pitch));
        if ui.button("Found").clicked()&&!self.model.found.contains(&row.id){self.checkpoint();self.model.found.push(row.id);}
        ui.add(egui::ProgressBar::new(self.model.found.len() as f32/30.).show_percentage());
    }
    fn board(&mut self, ui: &mut egui::Ui) {
        let (rect,_) = ui.allocate_exact_size(Vec2::new(ui.available_width(),330.),egui::Sense::hover());
        let paint = ui.painter_at(rect); let time = ui.input(|i|i.time);
        for i in 0..64 {let x=rect.left()+(i%8) as f32*rect.width()/8.;let y=rect.top()+(i/8) as f32*40.;
            let r=6.+(time+i as f64*.7).sin() as f32*3.;paint.circle_stroke(Pos2::new(x+20.,y+20.),r,Stroke::new(1.,Color32::from_rgb(80,140,210)));}
        ui.label(format!("{} entries · {} notes · {}/30",self.model.entries.len(),self.model.notes.len(),self.model.found.len()));
        ui.color_edit_button_srgb(&mut self.model.palette);
        ui.horizontal(|ui|{ui.text_edit_singleline(&mut self.model.filename);if ui.button("Save").clicked(){self.save_file();}if ui.button("Load").clicked(){self.load_file();}});
        ui.label(&self.message);
    }
}
impl eframe::App for Station {
    fn save(&mut self, storage: &mut dyn eframe::Storage) {if let Ok(text)=serde_json::to_string(&self.model){storage.set_string("station",text);}}
    fn update(&mut self, ctx: &egui::Context, _: &mut eframe::Frame) {
        egui::TopBottomPanel::top("bar").show(ctx,|ui|{ui.horizontal(|ui|{
            ui.heading("Station");for (i,name) in ["Shelf","Keys","Rooms","Board"].iter().enumerate(){if ui.selectable_label(self.page==i,*name).clicked(){self.page=i;}}
            if ui.button("↶").clicked(){self.undo();}if ui.button("↷").clicked(){self.redo();}
        });});
        egui::CentralPanel::default().show(ctx,|ui|match self.page{0=>self.shelf(ui),1=>self.piano(ui),2=>self.map(ui),_=>self.board(ui)});
        ctx.request_repaint_after(std::time::Duration::from_millis(33));
    }
}
fn main() -> eframe::Result {
    let native=eframe::NativeOptions{viewport:egui::ViewportBuilder::default().with_inner_size([1040.,760.]),..Default::default()};
    eframe::run_native("Station",native,Box::new(|cc|Ok(Box::new(Station::new(cc)))))
}
